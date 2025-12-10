export const testWorkflows = {
  test1: {
    name: 'Test 1',
    category: 'test',
    tasks: [
      {
        taskName: 'Get Latest Email',
        inputs: {
          emailAccount: 'GMAIL_1',
        },
      },
    ],
  },
  test2: {
    name: 'Test 2',
    category: 'test',
    tasks: [
      {
        taskName: 'Send Email',
        inputs: {
          senderAccount: 'GMAIL_1',
          receiverEmail: 'ln613@hotmail.com',
          subject: 'hh',
          body: 'hello',
        },
      },
    ],
  },
  test3: {
    name: 'Test 3',
    category: 'test',
    tasks: [
      {
        taskName: 'Open Browser Window',
        inputs: {
          browserType: 'chrome',
          url: 'https://github.com/ln613/roo-rules-server',
        },
      },
      {
        taskName: 'Find Element',
        inputs: {
          selector: 'h1.heading-element',
          attributes: 'text',
        },
      },
    ],
  },
}