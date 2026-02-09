import { backgroundEvents, startBackgroundTask } from '../background/index.js'
import { executeWorkflow, workflows } from './index.js'
import { getOne, save, remove } from '../db.js'

// Store registered triggers
const registeredTriggers = new Map()

// Collection name for pending composite triggers
const PENDING_TRIGGERS_COLLECTION = 'pendingTriggers'

/**
 * Convert workflow key to environment variable name
 * e.g., 'testWW' -> 'TEST_WW_TRIGGER', 'testFileWatch' -> 'TEST_FILE_WATCH_TRIGGER'
 * @param {string} workflowKey - Workflow key in camelCase
 * @returns {string} Environment variable name
 */
const getEnvVarName = (workflowKey) => {
  // Convert camelCase to SCREAMING_SNAKE_CASE
  const snakeCase = workflowKey.replace(/([A-Z])/g, '_$1').toUpperCase()
  return `${snakeCase}_TRIGGER`
}

/**
 * Check if a workflow trigger is enabled via environment variable
 * Format: {WORKFLOW_NAME}_TRIGGER=1 (1 = on, 0 = off, default off)
 * @param {string} workflowKey - Workflow key
 * @returns {boolean} Whether the trigger is enabled
 */
const isTriggerEnabled = (workflowKey) => {
  const envVarName = getEnvVarName(workflowKey)
  const envValue = process.env[envVarName]
  return envValue === '1'
}

/**
 * Register event triggers for all workflows that have them
 */
export const registerAllEventTriggers = () => {
  console.log('[Triggers] Registering event triggers for workflows...')
  
  for (const [workflowKey, workflow] of Object.entries(workflows)) {
    if (workflow.eventTrigger) {
      if (isTriggerEnabled(workflowKey)) {
        registerWorkflowTrigger(workflowKey, workflow)
      } else {
        const envVarName = getEnvVarName(workflowKey)
        console.log(`[Triggers] Trigger for workflow '${workflow.name}' is disabled (set ${envVarName}=1 to enable)`)
      }
    }
  }
  
  console.log(`[Triggers] Registered ${registeredTriggers.size} event triggers`)
}

/**
 * Register a single workflow's event trigger
 * @param {string} workflowKey - Workflow key
 * @param {Object} workflow - Workflow definition
 */
const registerWorkflowTrigger = (workflowKey, workflow) => {
  const { eventTrigger } = workflow

  validateEventTrigger(eventTrigger, workflowKey)

  const { event, condition, compositeCondition, inputMapping } = eventTrigger

  // Start the background task if needed, passing workflowKey for identification
  startBackgroundTaskForEvent(event, workflowKey)

  // Create the event handler - handle composite or simple conditions
  const handler = compositeCondition
    ? createCompositeEventHandler(workflowKey, workflow, compositeCondition, inputMapping)
    : createEventHandler(workflowKey, workflow, condition, inputMapping)

  // Register the event listener
  const eventName = getEventName(event)
  backgroundEvents.on(eventName, handler)

  registeredTriggers.set(workflowKey, {
    eventName,
    handler,
    event,
    condition: condition || compositeCondition,
  })

  console.log(`[Triggers] Registered trigger for workflow '${workflow.name}' on event '${eventName}'`)
}

/**
 * Validate event trigger configuration
 * @param {Object} eventTrigger - Event trigger config
 * @param {string} workflowKey - Workflow key for error messages
 */
const validateEventTrigger = (eventTrigger, workflowKey) => {
  if (!eventTrigger.event) {
    throw new Error(`Event trigger for workflow '${workflowKey}' must have an 'event' property`)
  }
}

/**
 * Start the background task required for an event
 * @param {Object} event - Event configuration
 * @param {string} workflowKey - Workflow key for identification
 */
const startBackgroundTaskForEvent = (event, workflowKey) => {
  if (event.type === 'watchEmail') {
    startBackgroundTask('watchEmail', {
      emailAccount: event.emailAccount,
      pollingInterval: event.pollingInterval || 60,
    })
  } else if (event.type === 'watchFiles') {
    startBackgroundTask('watchFiles', {
      folder: event.folder,
      changeType: event.changeType,
      filePattern: event.filePattern,
      workflowKey, // Pass the workflow key for event identification
    })
  }
}

/**
 * Get the event name from event configuration
 * @param {Object} event - Event configuration
 * @returns {string} Event name
 */
const getEventName = (event) => {
  if (event.type === 'watchEmail') {
    return 'newEmail'
  }
  if (event.type === 'watchFiles') {
    return 'fileChange'
  }
  return event.type
}

/**
 * Create an event handler for a workflow trigger
 * @param {string} workflowKey - Workflow key
 * @param {Object} workflow - Workflow definition
 * @param {Object} condition - Trigger condition
 * @param {Object} inputMapping - Input mapping from event data to workflow inputs
 * @returns {Function} Event handler
 */
const createEventHandler = (workflowKey, workflow, condition, inputMapping) => {
  return async (eventData) => {
    console.log(`[Triggers] Event received for workflow '${workflow.name}'`)

    // Check if this event is for this workflow (for file watchers)
    if (eventData.workflowId && eventData.workflowId !== workflowKey) {
      return
    }

    // Check if condition is met
    if (condition && !checkCondition(condition, eventData)) {
      console.log(`[Triggers] Condition not met for workflow '${workflow.name}', skipping`)
      return
    }

    // Map event data to workflow inputs
    const workflowInputs = mapEventDataToInputs(eventData, inputMapping)

    // Add event data to context for template resolution
    workflowInputs._eventData = eventData

    console.log(`[Triggers] Executing workflow '${workflow.name}' with inputs:`, workflowInputs)

    try {
      const result = await executeWorkflow(workflowKey, workflowInputs, { event: eventData })
      console.log(`[Triggers] Workflow '${workflow.name}' completed successfully`)
      return result
    } catch (error) {
      console.error(`[Triggers] Workflow '${workflow.name}' failed:`, error.message)
    }
  }
}

/**
 * Create an event handler for composite conditions (multiple conditions that must all be met)
 * @param {string} workflowKey - Workflow key
 * @param {Object} workflow - Workflow definition
 * @param {Object} compositeCondition - Composite condition configuration
 * @param {Object} inputMapping - Input mapping from event data to workflow inputs
 * @returns {Function} Event handler
 */
const createCompositeEventHandler = (workflowKey, workflow, compositeCondition, inputMapping) => {
  return async (eventData) => {
    console.log(`[Triggers] Event received for composite workflow '${workflow.name}'`)

    // Check if this event is for this workflow (for file watchers)
    if (eventData.workflowId && eventData.workflowId !== workflowKey) {
      return
    }

    const { type, matchKey, conditions } = compositeCondition

    // Find which condition this event matches
    const matchedCondition = findMatchingCondition(conditions, eventData)

    if (!matchedCondition) {
      console.log(`[Triggers] No condition matched for workflow '${workflow.name}', skipping`)
      return
    }

    console.log(`[Triggers] Condition '${matchedCondition.id}' matched for workflow '${workflow.name}'`)

    // Extract the match key value from the event data
    const matchKeyValue = extractMatchKeyValue(matchedCondition, eventData)

    if (!matchKeyValue) {
      console.log(`[Triggers] Could not extract match key '${matchKey}' from event data, skipping`)
      return
    }

    console.log(`[Triggers] Extracted ${matchKey}: ${matchKeyValue}`)

    // Check if there's a pending trigger with the same match key
    const pendingTrigger = await getPendingTrigger(workflowKey, matchKey, matchKeyValue)

    if (pendingTrigger) {
      // Check if all conditions are now met
      const allConditionIds = conditions.map((c) => c.id)
      const triggeredIds = [...pendingTrigger.triggeredConditions, matchedCondition.id]
      const uniqueTriggeredIds = [...new Set(triggeredIds)]

      const allMet =
        type === 'all'
          ? allConditionIds.every((id) => uniqueTriggeredIds.includes(id))
          : uniqueTriggeredIds.length > 0

      if (allMet) {
        console.log(`[Triggers] All conditions met for workflow '${workflow.name}', executing...`)

        // Remove the pending trigger
        await removePendingTrigger(workflowKey, matchKey, matchKeyValue)

        // Combine event data from all conditions
        const combinedEventData = {
          ...pendingTrigger.eventData,
          [matchedCondition.id]: eventData,
        }

        // Map combined event data to workflow inputs
        const workflowInputs = mapEventDataToInputs(combinedEventData, inputMapping)
        workflowInputs._eventData = combinedEventData

        console.log(`[Triggers] Executing workflow '${workflow.name}' with inputs:`, workflowInputs)

        try {
          const result = await executeWorkflow(workflowKey, workflowInputs, { event: combinedEventData })
          console.log(`[Triggers] Workflow '${workflow.name}' completed successfully`)
          return result
        } catch (error) {
          console.error(`[Triggers] Workflow '${workflow.name}' failed:`, error.message)
        }
      } else {
        // Update the pending trigger with this new condition
        await updatePendingTrigger(workflowKey, matchKey, matchKeyValue, matchedCondition.id, eventData)
        console.log(`[Triggers] Updated pending trigger for workflow '${workflow.name}', waiting for other conditions`)
      }
    } else {
      // Save this as a pending trigger
      await savePendingTrigger(workflowKey, matchKey, matchKeyValue, matchedCondition.id, eventData)
      console.log(`[Triggers] Saved pending trigger for workflow '${workflow.name}', waiting for other conditions`)
    }
  }
}

/**
 * Find which condition matches the event data
 * @param {Array} conditions - Array of condition configurations
 * @param {Object} eventData - Event data
 * @returns {Object|null} Matched condition or null
 */
const findMatchingCondition = (conditions, eventData) => {
  for (const condition of conditions) {
    if (checkCondition(condition, eventData)) {
      return condition
    }
  }
  return null
}

/**
 * Extract the match key value from event data based on condition configuration
 * @param {Object} condition - Condition that matched
 * @param {Object} eventData - Event data
 * @returns {string|null} Extracted match key value or null
 */
const extractMatchKeyValue = (condition, eventData) => {
  if (!condition.extractLabReportId) {
    return null
  }

  const { from, pattern, filter, property } = condition.extractLabReportId

  // Get the source value
  let sourceValue = getValueByPath(eventData, from)

  // Apply filter if specified (for arrays)
  if (filter && Array.isArray(sourceValue)) {
    sourceValue = sourceValue.find((item) => {
      if (filter.extension) {
        const filename = item.filename?.toLowerCase() || ''
        return filename.endsWith(filter.extension.toLowerCase())
      }
      return true
    })
  }

  // Get property if specified
  if (property && sourceValue && typeof sourceValue === 'object') {
    sourceValue = sourceValue[property]
  }

  // Apply regex pattern to extract value
  if (pattern && typeof sourceValue === 'string') {
    const regex = new RegExp(pattern)
    const match = sourceValue.match(regex)
    if (match && match[1]) {
      return match[1]
    }
  }

  return typeof sourceValue === 'string' ? sourceValue : null
}

/**
 * Get a pending trigger from the database
 * @param {string} workflowKey - Workflow key
 * @param {string} matchKey - Match key name
 * @param {string} matchKeyValue - Match key value
 * @returns {Object|null} Pending trigger or null
 */
const getPendingTrigger = async (workflowKey, matchKey, matchKeyValue) => {
  try {
    return await getOne(PENDING_TRIGGERS_COLLECTION, {
      workflowKey,
      matchKey,
      matchKeyValue,
    })
  } catch (error) {
    console.error('[Triggers] Error getting pending trigger:', error.message)
    return null
  }
}

/**
 * Save a new pending trigger to the database
 * @param {string} workflowKey - Workflow key
 * @param {string} matchKey - Match key name
 * @param {string} matchKeyValue - Match key value
 * @param {string} conditionId - ID of the triggered condition
 * @param {Object} eventData - Event data
 */
const savePendingTrigger = async (workflowKey, matchKey, matchKeyValue, conditionId, eventData) => {
  try {
    await save(PENDING_TRIGGERS_COLLECTION, {
      workflowKey,
      matchKey,
      matchKeyValue,
      triggeredConditions: [conditionId],
      eventData: {
        [conditionId]: eventData,
      },
      createdAt: new Date(),
    })
  } catch (error) {
    console.error('[Triggers] Error saving pending trigger:', error.message)
  }
}

/**
 * Update an existing pending trigger with a new condition
 * @param {string} workflowKey - Workflow key
 * @param {string} matchKey - Match key name
 * @param {string} matchKeyValue - Match key value
 * @param {string} conditionId - ID of the triggered condition
 * @param {Object} eventData - Event data
 */
const updatePendingTrigger = async (workflowKey, matchKey, matchKeyValue, conditionId, eventData) => {
  try {
    const pending = await getPendingTrigger(workflowKey, matchKey, matchKeyValue)
    if (pending) {
      pending.triggeredConditions = [...new Set([...pending.triggeredConditions, conditionId])]
      pending.eventData[conditionId] = eventData
      pending.updatedAt = new Date()
      await save(PENDING_TRIGGERS_COLLECTION, pending)
    }
  } catch (error) {
    console.error('[Triggers] Error updating pending trigger:', error.message)
  }
}

/**
 * Remove a pending trigger from the database
 * @param {string} workflowKey - Workflow key
 * @param {string} matchKey - Match key name
 * @param {string} matchKeyValue - Match key value
 */
const removePendingTrigger = async (workflowKey, matchKey, matchKeyValue) => {
  try {
    await remove(PENDING_TRIGGERS_COLLECTION, {
      workflowKey,
      matchKey,
      matchKeyValue,
    })
  } catch (error) {
    console.error('[Triggers] Error removing pending trigger:', error.message)
  }
}

/**
 * Check if the trigger condition is met
 * @param {Object} condition - Condition configuration
 * @param {Object} eventData - Event data
 * @returns {boolean} Whether condition is met
 */
const checkCondition = (condition, eventData) => {
  // Handle file change events
  if (eventData.changeType && eventData.file) {
    return checkFileCondition(condition, eventData)
  }

  // Handle email events
  const { email } = eventData

  if (!email) return false

  // Check subject pattern
  if (condition.subjectPattern) {
    const regex = new RegExp(condition.subjectPattern, 'i')
    if (!regex.test(email.subject || '')) {
      console.log(`[Triggers] Subject '${email.subject}' does not match pattern '${condition.subjectPattern}'`)
      return false
    }
  }

  // Check attachment requirements
  if (condition.attachments) {
    const attachments = email.attachments || []

    // Check minimum count
    if (condition.attachments.minCount && attachments.length < condition.attachments.minCount) {
      console.log(`[Triggers] Not enough attachments: ${attachments.length} < ${condition.attachments.minCount}`)
      return false
    }

    // Check required types
    if (condition.attachments.requiredTypes) {
      for (const requiredType of condition.attachments.requiredTypes) {
        const hasType = attachments.some((att) => {
          const filename = att.filename?.toLowerCase() || ''
          if (requiredType === 'excel') {
            return filename.endsWith('.xlsx') || filename.endsWith('.xls')
          }
          if (requiredType === 'pdf') {
            return filename.endsWith('.pdf')
          }
          return filename.includes(requiredType.toLowerCase())
        })

        if (!hasType) {
          console.log(`[Triggers] Missing required attachment type: ${requiredType}`)
          return false
        }
      }
    }
  }

  return true
}

/**
 * Check if file change condition is met
 * @param {Object} condition - Condition configuration
 * @param {Object} eventData - Event data with file info
 * @returns {boolean} Whether condition is met
 */
const checkFileCondition = (condition, eventData) => {
  const { changeType, file } = eventData

  // Check change type if specified in condition
  if (condition.changeType && condition.changeType !== changeType) {
    console.log(`[Triggers] Change type '${changeType}' does not match '${condition.changeType}'`)
    return false
  }

  // Check file pattern if specified
  if (condition.filePattern) {
    const regexPattern = condition.filePattern.replace(/\./g, '\\.').replace(/\*/g, '.*').replace(/\?/g, '.')

    const regex = new RegExp(`^${regexPattern}$`, 'i')
    if (!regex.test(file.name)) {
      console.log(`[Triggers] File '${file.name}' does not match pattern '${condition.filePattern}'`)
      return false
    }
  }

  return true
}

/**
 * Map event data to workflow inputs
 * @param {Object} eventData - Event data
 * @param {Object} inputMapping - Input mapping configuration
 * @returns {Object} Workflow inputs
 */
const mapEventDataToInputs = (eventData, inputMapping) => {
  if (!inputMapping) return {}
  
  const inputs = {}
  const { email } = eventData
  
  for (const [inputName, mapping] of Object.entries(inputMapping)) {
    if (typeof mapping === 'string') {
      // Simple path mapping like 'email.attachments[0].path'
      inputs[inputName] = getValueByPath(eventData, mapping)
    } else if (typeof mapping === 'object' && mapping.from) {
      // Complex mapping with transformation
      let value = getValueByPath(eventData, mapping.from)
      
      // Apply filter if specified
      if (mapping.filter && Array.isArray(value)) {
        value = value.find((item) => {
          if (mapping.filter.extension) {
            const filename = item.filename?.toLowerCase() || ''
            return filename.endsWith(mapping.filter.extension.toLowerCase())
          }
          return true
        })
      }
      
      // Get specific property if specified
      if (mapping.property && value) {
        value = value[mapping.property]
      }
      
      inputs[inputName] = value
    }
  }
  
  return inputs
}

/**
 * Get value from object by dot-notation path
 * @param {Object} obj - Source object
 * @param {string} path - Dot-notation path (supports array index like 'arr[0]')
 * @returns {*} Value at path
 */
const getValueByPath = (obj, path) => {
  const parts = path.replace(/\[(\d+)\]/g, '.$1').split('.')
  let current = obj
  
  for (const part of parts) {
    if (current === undefined || current === null) {
      return undefined
    }
    current = current[part]
  }
  
  return current
}

/**
 * Unregister all event triggers
 */
export const unregisterAllEventTriggers = () => {
  for (const [workflowKey, triggerInfo] of registeredTriggers) {
    backgroundEvents.off(triggerInfo.eventName, triggerInfo.handler)
    console.log(`[Triggers] Unregistered trigger for workflow '${workflowKey}'`)
  }
  registeredTriggers.clear()
}
