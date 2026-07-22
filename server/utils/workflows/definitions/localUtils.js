import { stat, readdir, copyFile, unlink, mkdir, access } from 'fs/promises'
import { join, basename } from 'path'
import { pinyin } from 'pinyin-pro'

// ============================================================
// KS Cut utilities
// ============================================================

/**
 * Resolve a file path to a list of .mp4 files
 * If path is a folder, returns all .mp4 files (ignoring sub folders); otherwise returns the single file
 */
export const getMp4Files = async (ctx) => {
  validatePath(ctx.path)
  const s = await stat(ctx.path)
  if (s.isDirectory()) {
    const entries = await readdir(ctx.path, { withFileTypes: true })
    return {
      files: entries
        .filter((e) => e.isFile() && e.name.toLowerCase().endsWith('.mp4'))
        .map((e) => join(ctx.path, e.name)),
    }
  }
  return { files: [ctx.path] }
}

/**
 * Compute cut start/end times from trim values and duration
 */
export const computeKsCutTimes = (ctx) => ({
  cutStart: parseFloat(ctx.trimStart) || 0,
  cutEnd: ctx.durationResult.duration - (parseFloat(ctx.trimEnd) || 0),
})

// ============================================================
// WW QC utilities
// ============================================================

/**
 * Determine the lab branch (CARO or ALS) from the lab token in context
 * Used to branch the WW QC workflow between the CARO (PDF/HTML) and ALS (COA excel) paths
 */
export const resolveLabBranch = (ctx) => {
  const lab = String(ctx.lab || '').toUpperCase()
  return { isCaro: lab === 'CARO', isAls: lab === 'ALS' }
}

/**
 * Friendly labels for QC difference field paths
 */
const QC_FIELD_LABELS = {
  result: 'Result',
  unit: 'Unit',
  analyte: 'Analyte',
  'sampleInfo.collectionDate': 'Date',
  'sampleInfo.collectionTime': 'Time',
  'sampleInfo.clientSampleId': 'Client Sample ID',
  'sampleInfo.samplingLocationName': 'Sampling Location Name',
  'sampleInfo.matrix': 'Matrix',
  'sampleInfo.labSampleId': 'Lab Sample ID',
}

/**
 * Map a QC difference field path to a friendly label (e.g., "sampleInfo.collectionDate" -> "Date")
 */
const qcFieldLabel = (field) => {
  if (QC_FIELD_LABELS[field]) return QC_FIELD_LABELS[field]
  // Cross-field paths look like "sampleInfo.clientSampleId / sampleInfo.samplingLocationName"
  const first = String(field).split(' / ')[0]
  if (QC_FIELD_LABELS[first]) return QC_FIELD_LABELS[first]
  const segment = first.split('.').pop()
  return segment
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, (c) => c.toUpperCase())
    .trim()
}

/**
 * Group array items into an object keyed by keyFn
 */
const groupBy = (items, keyFn) => {
  const out = {}
  for (const item of items) {
    const k = keyFn(item)
    if (!out[k]) out[k] = []
    out[k].push(item)
  }
  return out
}

/**
 * Get the character bigrams of a normalized string (lowercased, non-alphanumerics collapsed to spaces)
 */
const bigrams = (str) => {
  const s = String(str).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
  const grams = []
  for (let i = 0; i < s.length - 1; i++) {
    grams.push(s.slice(i, i + 2))
  }
  return grams
}

/**
 * String similarity via the Sørensen-Dice coefficient over character bigrams (0..1)
 */
const nameSimilarity = (a, b) => {
  const ga = bigrams(a)
  const gb = bigrams(b)
  if (ga.length === 0 || gb.length === 0) return 0

  const counts = new Map()
  for (const g of ga) counts.set(g, (counts.get(g) || 0) + 1)

  let intersection = 0
  for (const g of gb) {
    const c = counts.get(g) || 0
    if (c > 0) {
      intersection++
      counts.set(g, c - 1)
    }
  }

  return (2 * intersection) / (ga.length + gb.length)
}

/**
 * Build "Name Mismatch" pairs from analyte-level missing differences
 * A missing_in_list2 item (present in list 1) is paired with a missing_in_list1 item
 * (present in list 2) that shares the same lab sample id and category - they likely refer
 * to the same analyte under different names. Within each group, pairs are chosen greedily
 * by highest name similarity (most similar names paired first). Unpaired items are returned separately.
 */
const buildNameGroups = (differences) => {
  const missingInList2 = differences.filter((d) => d.type === 'missing_in_list2' && d.differences === undefined)
  const missingInList1 = differences.filter((d) => d.type === 'missing_in_list1' && d.differences === undefined)

  const key = (d) => `${d.labSampleId || ''}||${d.category || ''}`
  const grouped1 = groupBy(missingInList1, key)
  const grouped2 = groupBy(missingInList2, key)

  const nameMismatches = []
  const used1 = new Set()
  const used2 = new Set()

  for (const groupKey of Object.keys(grouped2)) {
    const items2 = grouped2[groupKey]
    const items1 = grouped1[groupKey] || []
    if (items1.length === 0) continue

    // Score every candidate pair, then greedily take the most similar available pairs
    const pairs = []
    for (const it2 of items2) {
      for (const it1 of items1) {
        pairs.push({ it2, it1, score: nameSimilarity(it2.analyte, it1.analyte) })
      }
    }
    pairs.sort((a, b) => b.score - a.score)

    for (const { it2, it1 } of pairs) {
      if (used2.has(it2) || used1.has(it1)) continue
      used2.add(it2)
      used1.add(it1)
      nameMismatches.push({
        labSampleId: it2.labSampleId,
        category: it2.category,
        list1Name: it2.analyte, // present in list 1, missing from list 2
        list2Name: it1.analyte, // present in list 2, missing from list 1
      })
    }
  }

  return {
    nameMismatches,
    missingList2: missingInList2.filter((d) => !used2.has(d)),
    missingList1: missingInList1.filter((d) => !used1.has(d)),
  }
}

/**
 * Build "Different {field}" groups from field-level mismatch differences
 * @returns {Array} Array of [groupTitle, items] entries
 */
const buildFieldGroups = (differences) => {
  const fieldDiffs = differences.filter((d) => Array.isArray(d.differences))
  const groups = new Map()

  for (const entry of fieldDiffs) {
    for (const sub of entry.differences) {
      const title = `Different ${qcFieldLabel(sub.field)}`
      if (!groups.has(title)) groups.set(title, [])
      groups.get(title).push({
        labSampleId: entry.labSampleId,
        category: entry.category,
        analyte: entry.analyte,
        value1: sub.value1,
        value2: sub.value2,
      })
    }
  }

  return [...groups.entries()]
}

/**
 * Format a value for display (quoted, or "(missing)" when absent)
 */
const formatValue = (value) =>
  value !== undefined && value !== null && value !== '' ? `"${value}"` : '(missing)'

const formatNameMismatchSection = (items) => {
  const lines = items.map(
    (it) => `  - ${it.labSampleId} / ${it.category}: "${it.list1Name}" (possible match: "${it.list2Name}")`,
  )
  return `Name Mismatch (${items.length}):\n${lines.join('\n')}`
}

const formatFieldSection = (title, items) => {
  const lines = items.map(
    (it) => `  - ${it.labSampleId} / ${it.category} / ${it.analyte}: ${formatValue(it.value1)} vs ${formatValue(it.value2)}`,
  )
  return `${title} (${items.length}):\n${lines.join('\n')}`
}

const formatMissingSection = (title, items) => {
  const lines = items.map((it) => `  - ${it.labSampleId} / ${it.category} / ${it.analyte}`)
  return `${title} (${items.length}):\n${lines.join('\n')}`
}

/**
 * Format QC check differences into a grouped, human-readable summary for the result email:
 * - "Name Mismatch": paired missing analytes (likely the same analyte under different names)
 * - "Different {field}": field-level mismatches grouped by field (Result, Date, Time, ...)
 * - leftover unpaired missing analytes under "Missing in list 1 / list 2"
 * @returns {Object} { differencesSummary } to merge into the workflow context
 */
export const formatQcDifferences = (ctx) => {
  const qcResult = ctx.qcResult
  if (!qcResult) {
    return { differencesSummary: 'QC comparison was not performed (QC Excel not found).' }
  }

  const differences = qcResult.differences || []
  if (differences.length === 0) {
    return { differencesSummary: 'No differences found.' }
  }

  const { nameMismatches, missingList1, missingList2 } = buildNameGroups(differences)
  const fieldGroups = buildFieldGroups(differences)

  const sections = []
  if (nameMismatches.length > 0) {
    sections.push(formatNameMismatchSection(nameMismatches))
  }
  for (const [title, items] of fieldGroups) {
    sections.push(formatFieldSection(title, items))
  }
  if (missingList2.length > 0) {
    sections.push(formatMissingSection('Missing in list 2', missingList2))
  }
  if (missingList1.length > 0) {
    sections.push(formatMissingSection('Missing in list 1', missingList1))
  }

  return { differencesSummary: sections.join('\n\n') }
}

// ============================================================
// Comfy FSV utilities
// ============================================================

const COMFY_INPUT_DIR = '\\\\nan-ai\\aic\\Software\\comfy\\ComfyUI\\input'
const COMFY_OUTPUT_DIR = '\\\\nan-ai\\aic\\Software\\comfy\\ComfyUI\\output'
const OUTPUT_BASE_DIR = 'C:\\T\\fg\\v'

/**
 * Resolve scope (file or folder) to a list of files (ignoring sub folders) with optional folder name
 */
export const getFilesWithFolderName = async (ctx) => {
  validatePath(ctx.scope)
  const s = await stat(ctx.scope)
  if (s.isDirectory()) {
    const entries = await readdir(ctx.scope, { withFileTypes: true })
    return {
      files: entries
        .filter((e) => e.isFile())
        .map((e) => join(ctx.scope, e.name)),
      folderName: basename(ctx.scope),
    }
  }
  return { files: [ctx.scope], folderName: null }
}

/**
 * Prepare comfy FSV file processing: compute target info and check if target exists
 * If target exists, sets skipped=true; otherwise copies file to comfy input
 */
export const prepareComfyFsvFile = async (ctx) => {
  const fileName = basename(ctx.file)
  const targetFileName = `${ctx.type}-${fileName}`
  const targetFolder = getOutputDestinationDir(ctx.folderName)
  const targetFilePath = join(targetFolder, targetFileName)

  if (await fileExists(targetFilePath)) {
    console.log(`Target file already exists, skipping: ${targetFilePath}`)
    return {
      shouldProcess: false,
      fileName,
      targetFileName,
      targetFolder,
      message: `Skipped ${fileName} - target already exists`,
    }
  }

  const copiedFilePath = await copyFileToComfyInput(ctx.file, fileName)
  return {
    shouldProcess: true,
    fileName,
    targetFileName,
    targetFolder,
    copiedFilePath,
  }
}

/**
 * Build comfy workflow params based on type, fileName, count, and order
 */
export const buildComfyFsvWorkflowInputs = (ctx) => {
  const faces = calculateFaces(ctx.count)
  const workflowPath = `./server/utils/comfy/${ctx.type}.json`
  const params = buildComfyFsvParams(ctx.type, ctx.prepResult.fileName, faces, ctx.order)
  return { workflowPath, params, outputKey: 'images:31' }
}

/**
 * Post-process comfy FSV result: rename, move output file, delete copied input
 */
export const postProcessComfyFsv = async (ctx) => {
  const outputFileName = ctx.comfyResult
  const { targetFileName, targetFolder, copiedFilePath } = ctx.prepResult

  const renamedFileName = await renameAndMoveGeneratedFile(
    outputFileName,
    targetFileName,
    targetFolder,
  )
  await deleteCopiedInputFile(copiedFilePath)

  return {
    success: true,
    fileName: renamedFileName || targetFileName,
    message: `Successfully processed ${ctx.prepResult.fileName}`,
  }
}

// ============================================================
// Shared helpers
// ============================================================

const validatePath = (filePath) => {
  if (!filePath) throw new Error('File path is required')
}

const fileExists = async (filePath) => {
  try {
    await access(filePath)
    return true
  } catch {
    return false
  }
}

const copyFileToComfyInput = async (sourcePath, fileName) => {
  const destPath = join(COMFY_INPUT_DIR, fileName)
  await copyFile(sourcePath, destPath)
  return destPath
}

const convertChineseToFolderName = (name) => {
  if (!name) return null
  const hasChinese = /[\u4e00-\u9fa5]/.test(name)
  if (!hasChinese) return name
  const pinyinResult = pinyin(name, { toneType: 'none', type: 'array' })
  return pinyinResult.join('')
}

const getOutputDestinationDir = (folderName) => {
  if (!folderName) return OUTPUT_BASE_DIR
  const convertedFolderName = convertChineseToFolderName(folderName)
  return join(OUTPUT_BASE_DIR, convertedFolderName)
}

const calculateFaces = (count) => {
  if (count === '2' || count === 2) return '0,1'
  if (count === '3' || count === 3) return '0,1,2'
  return '0'
}

const buildComfyFsvParams = (type, fileName, faces, order) => {
  if (type === 'fsvr') {
    return [{ key: '45.inputs.video', value: `ComfyUI/input/${fileName}` }]
  }
  return [
    { key: '47.inputs.video', value: fileName },
    { key: '41.inputs.input_faces_index', value: faces },
    { key: '41.inputs.input_faces_order', value: order },
  ]
}

const moveFileCrossDevice = async (sourcePath, destPath) => {
  await copyFile(sourcePath, destPath)
  await unlink(sourcePath)
}

const renameAndMoveGeneratedFile = async (outputFileName, targetFileName, targetFolder) => {
  if (!outputFileName) {
    console.log('No output file name, skipping rename and move')
    return null
  }

  const oldPath = join(COMFY_OUTPUT_DIR, outputFileName)
  await mkdir(targetFolder, { recursive: true })
  const destPath = join(targetFolder, targetFileName)

  console.log(`Moving and renaming: ${oldPath} -> ${destPath}`)
  try {
    await moveFileCrossDevice(oldPath, destPath)
    console.log('Move and rename successful')
    return targetFileName
  } catch (error) {
    console.error(`Failed to move and rename output file: ${error.message}`)
    return null
  }
}

const deleteCopiedInputFile = async (copiedFilePath) => {
  console.log(`Deleting copied file: ${copiedFilePath}`)
  try {
    await unlink(copiedFilePath)
    console.log('Delete successful')
  } catch (error) {
    console.error(`Failed to delete copied input file: ${error.message}`)
  }
}
