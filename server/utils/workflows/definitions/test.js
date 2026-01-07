export const testWorkflows = {
  testGetEmail: {
    name: 'Test Get Email',
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
  testSendEmail: {
    name: 'Test Send Email',
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
  testBrowserAutomation: {
    name: 'Test Browser Automation',
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
          text: 'WW_LAB',
        },
      },
      {
        taskName: 'Enter Text',
        inputs: {
          selector: '#password',
          text: 'WW_LAB_PASSWORD',
        },
      },
      {
        taskName: 'Click Element',
        inputs: {
          selector: 'button.filter',
        },
      },
      {
        taskName: 'Wait',
        inputs: {
          seconds: 3,
        },
      },
      {
        taskName: 'Navigate',
        inputs: {
          url: 'https://wirelesswater.com/labarchive',
        },
      },
      {
        taskName: 'Enter Text',
        inputs: {
          selector: '#txtSearch1',
          text: '25G3917',
        },
      },
      {
        taskName: 'Click Element',
        inputs: {
          selector: 'a[title="search"]',
        },
      },
      {
        taskName: 'Click Element',
        inputs: {
          selector: 'a[href^="/LabArchive/SummaryView/"]',
        },
      },
    ],
  },
  testOllama: {
    name: 'Test Ollama',
    category: 'test',
    tasks: [
      {
        forEach: {
          filesIn: {
            directory: 'C:\\ww\\h',
            extension: '.html',
          },
          as: 'file',
          contentAs: 'htmlContent',
          readContent: true,
        },
        tasks: [
          {
            taskName: 'Ollama API',
            inputs: {
              model: 'gemma3',
              prompt: 'extract the table in the html file into JSON:\n\n{{htmlContent}}',
            },
          },
        ],
        combineResults: 'array',
      },
    ],
  },
  testGemini: {
    name: 'Test Gemini',
    category: 'test',
    tasks: [
      {
        taskName: 'Open Browser Window',
        inputs: {
          browserType: 'chrome',
          url: 'https://gemini.google.com/app',
        },
      },
    ],
  },
}