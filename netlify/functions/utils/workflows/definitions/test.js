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
          url: 'https://wirelesswater.com/Account/LogOn?ReturnUrl=%2fmain',
        },
      },
      {
        taskName: 'Enter Text',
        inputs: {
          selector: '#username',
          text: 'WW_SUPPORT',
        },
      },
      {
        taskName: 'Enter Text',
        inputs: {
          selector: '#password',
          text: 'WW_SUPPORT_PASSWORD',
        },
      },
      {
        taskName: 'Click Element',
        inputs: {
          selector: 'button.filter',
        },
      },
    ],
  },
}