import { getLatestEmail, sendEmail } from './email.js'

export const tasks = {
  email: {
    getLatestEmail: {
      name: 'Get Latest Email',
      inputs: [
        { name: 'emailAccount', type: 'string', label: 'Email Account (env var)', required: true },
      ],
      outputs: ['sender', 'date', 'subject', 'body'],
      handler: getLatestEmail,
    },
    sendEmail: {
      name: 'Send Email',
      inputs: [
        { name: 'senderAccount', type: 'string', label: 'Sender Account (env var)', required: true },
        { name: 'receiverEmail', type: 'string', label: 'Receiver Email', required: true },
        { name: 'subject', type: 'string', label: 'Subject', required: true },
        { name: 'body', type: 'text', label: 'Email Body', required: true },
      ],
      outputs: ['success', 'message'],
      handler: sendEmail,
    },
  },
}

export const getTaskByName = (taskName) => {
  for (const category of Object.values(tasks)) {
    for (const [key, task] of Object.entries(category)) {
      if (task.name === taskName) {
        return { ...task, key }
      }
    }
  }
  return null
}

export const getAllTasks = () => {
  const result = []
  for (const [category, categoryTasks] of Object.entries(tasks)) {
    result.push({
      category,
      tasks: Object.entries(categoryTasks).map(([key, task]) => ({
        key,
        name: task.name,
        inputs: task.inputs,
        outputs: task.outputs,
      })),
    })
  }
  return result
}