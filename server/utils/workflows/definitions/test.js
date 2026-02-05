export const testWorkflows = {
  testGetEmail: {
    name: 'Test Get Email',
    category: 'test',
    tasks: [
      {
        taskName: 'Get Latest Email with attachment',
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
  testFileWatch: {
    name: 'Test File Watch',
    category: 'test',
    eventTrigger: {
      event: {
        type: 'watchFiles',
        folder: '/Users/nanli/t',
        changeType: 'created',
      },
    },
    tasks: [
      {
        taskName: 'Move File',
        inputs: {
          sourcePath: '{{event.file.path}}',
          destinationFolder: '/Users/nanli/t/tmp',
        },
        outputAs: 'moveResult',
      },
    ],
  },
  testWW: {
    name: 'Test WW',
    category: 'test',
    inputs: [
      {
        name: 'pdfPath',
        type: 'file',
        label: 'PDF File Path',
        required: true,
      },
    ],
    tasks: [
      {
        taskName: 'PDF to Htmls',
        inputs: {
          pdfPath: '{{pdfPath}}',
        },
        outputAs: 'pdfResult',
      },
      {
        taskName: 'Parse All QC Htmls',
        inputs: {
          folder: '{{pdfResult.folder}}',
          filterFn: (html) => html.includes('<b>TEST RESULTS</b>'),
        },
        outputAs: 'H',
      },
      {
        taskName: 'Generate Report',
        inputs: {
          labReportId: '{{H.metadata.labReportId}}',
        },
        outputAs: 'reportResult',
      },
      {
        taskName: 'Parse QC Excel',
        inputs: {
          labReportId: '{{H.metadata.labReportId}}',
        },
        outputAs: 'E',
      },
      {
        condition: '{{E}}',
        tasks: [
          {
            taskName: 'QC Check',
            inputs: {
              analyteList1: '{{H.analytes}}',
              analyteList2: '{{E.analytes}}',
            },
            outputAs: 'qcResult',
          },
        ],
      },
    ],
    output: 'qcResult',
  },
}