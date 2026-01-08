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
    inputs: [
      {
        name: 'model',
        type: 'dropdown',
        label: 'Model',
        required: true,
        optionsApi: 'ollamaList',
        default: 'qwen3-coder',
      },
      {
        name: 'type',
        type: 'radio',
        label: 'Type',
        required: true,
        options: [
          { text: 'image', value: 'C:\\ww\\caro\\img' },
          { text: 'html', value: 'C:\\ww\\caro\\html' },
        ],
        default: 'C:\\ww\\caro\\img',
      },
    ],
    tasks: [
      {
        forEach: {
          filesIn: {
            directory: '{{type}}',
            extensionByType: {
              'C:\\ww\\caro\\img': 'image',
              'C:\\ww\\caro\\html': '.html',
            },
          },
          as: 'file',
          contentAs: 'htmlContent',
          readContentByType: {
            'C:\\ww\\caro\\img': false,
            'C:\\ww\\caro\\html': true,
          },
        },
        tasks: [
          {
            taskName: 'Ollama API',
            inputs: {
              model: '{{model}}',
              images: '{{imageFile}}',
              prompt: `the table in the file contains the results of some analytes (grouped into categories) taken from a sample, convert the contents of the table into JSON format. DO NOT try to output values that are not in the file, if you cannot find the values for some fields, just use empty string

{{htmlContent}}`,
              format: {
                header: { reportedTo: '', project: '', workOrder: '', reported: '' },
                content: [
                  { analyte: '', result: '', RL: '', units: '', analyzed: '', qualifier: '', category: '' },
                ],
              },
            },
          },
        ],
        combineResults: 'mergeContent',
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