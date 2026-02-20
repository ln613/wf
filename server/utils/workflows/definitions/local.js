import {
  getMp4Files,
  computeKsCutTimes,
  getFilesWithFolderName,
  prepareComfyFsvFile,
  buildComfyFsvWorkflowInputs,
  postProcessComfyFsv,
} from './localUtils.js'

export const localWorkflows = {
  wwQc: {
    name: 'WW QC',
    category: 'local',
    eventTrigger: {
      event: {
        type: 'watchEmail',
        emailAccount: 'GMAIL_1',
        pollingInterval: 60,
      },
      compositeCondition: {
        type: 'all', // Require all conditions to be met
        matchKey: 'labReportId', // Key to match conditions together
        conditions: [
          {
            id: 'workOrder',
            subjectPattern: 'FW:\\s*CARO.*Work Order',
            attachments: {
              minCount: 2,
              requiredTypes: ['excel', 'pdf'],
            },
            extractLabReportId: {
              from: 'email.attachments',
              filter: { extension: '.pdf' },
              property: 'filename',
              // Extract lab report id from PDF filename (assuming format includes it)
              pattern: '(\\d+)',
            },
            inputMapping: {
              pdfPath: {
                from: 'email.attachments',
                filter: { extension: '.pdf' },
                property: 'path',
              },
            },
          },
          {
            id: 'labReportUpload',
            subjectPattern: 'Lab Report Upload Successful \\(Lab: .+, Lab Report ID: (\\d+)\\)',
            extractLabReportId: {
              from: 'email.subject',
              pattern: 'Lab Report ID: (\\d+)',
            },
          },
        ],
      },
      inputMapping: {
        pdfPath: {
          from: 'workOrder.email.attachments',
          filter: { extension: '.pdf' },
          property: 'path',
        },
      },
    },
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
          filterFn: (content) => content.includes('<p') && content.includes('<b>TEST RESULTS</b>'),
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
        condition: '{{E !== null}}',
        taskName: 'QC Check',
        inputs: {
          analyteList1: '{{H.analytes}}',
          analyteList2: '{{E.analytes}}',
        },
        outputAs: 'qcResult',
      },
      {
        taskName: 'Send Email',
        inputs: {
          senderAccount: 'GMAIL_1',
          receiverAccount: 'GMAIL_1',
          subject: 'QC result for {{H.metadata.labReportId}}',
          body: 'QC Check Result:\n\nHas Differences: {{qcResult.hasDifferences}}\n\nDifferences:\n{{qcResult.differences}}',
          attachments: ['{{pdfPath}}', '{{reportResult.reportPath}}'],
        },
      },
    ],
  },
  htmlExtract: {
    name: 'HTML Extract',
    category: 'local',
    inputs: [
      {
        name: 'url',
        type: 'string',
        label: 'URL',
        required: true,
      },
      {
        name: 'querySelector',
        type: 'string',
        label: 'Query Selector',
        required: true,
      },
      {
        name: 'attributes',
        type: 'string',
        label: 'Attributes (comma separated)',
        required: false,
        default: 'text',
      },
    ],
    tasks: [
      {
        taskName: 'Open Browser Window',
        inputs: {
          browserType: 'chrome',
          url: '{{url}}',
        },
        outputAs: 'browserWindow',
      },
      {
        taskName: 'Wait for Element',
        inputs: {
          connectionId: '{{browserWindow.connectionId}}',
          selector: '{{querySelector}}',
        },
        outputAs: 'waitResult',
      },
      {
        condition: '{{waitResult.found}}',
        taskName: 'Get Attribute',
        inputs: {
          connectionId: '{{browserWindow.connectionId}}',
          selector: '{{querySelector}}',
          attributes: '{{attributes}}',
        },
        outputAs: 'extractedAttributes',
      },
      {
        taskName: 'Close Browser Window',
        inputs: {
          connectionId: '{{browserWindow.connectionId}}',
        },
      },
    ],
    output: ['extractedAttributes', 'waitResult'],
  },
  ksCut: {
    name: 'KS Cut',
    category: 'local',
    inputs: [
      {
        name: 'path',
        type: 'file',
        label: 'File or Folder Path',
        required: true,
        defaultFolder: 'C:\\T\\ks',
      },
      {
        name: 'trimStart',
        type: 'number',
        label: 'Trim Start (seconds)',
        required: false,
        default: 0.133,
      },
      {
        name: 'trimEnd',
        type: 'number',
        label: 'Trim End (seconds)',
        required: false,
        default: 3.508,
      },
    ],
    tasks: [
      {
        handler: getMp4Files,
      },
      {
        forEach: {
          items: '{{files}}',
          as: 'file',
        },
        tasks: [
          {
            taskName: 'FFprobe Duration',
            inputs: { fileName: '{{file}}' },
            outputAs: 'durationResult',
          },
          {
            handler: computeKsCutTimes,
          },
          {
            taskName: 'FFmpeg Cut',
            inputs: {
              fileName: '{{file}}',
              start: '{{cutStart}}',
              end: '{{cutEnd}}',
            },
          },
        ],
        combineResults: 'array',
      },
    ],
  },
  comfyFsv: {
    name: 'Comfy fsv',
    category: 'local',
    inputs: [
      {
        name: 'type',
        type: 'radio',
        label: 'Workflow Type',
        required: false,
        default: 'fsv',
        options: [
          { value: 'fsv', text: 'fsv' },
          { value: 'fsvr', text: 'fsvr' },
          { value: 'fsi', text: 'fsi' },
        ],
      },
      {
        name: 'scope',
        type: 'file',
        label: 'File or Folder Path',
        required: true,
        defaultFolder: 'C:\\T\\ks',
      },
      {
        name: 'count',
        type: 'radio',
        label: 'Face Count',
        required: false,
        default: '1',
        options: [
          { value: '1', text: '1' },
          { value: '2', text: '2' },
          { value: '3', text: '3' },
        ],
      },
      {
        name: 'order',
        type: 'radio',
        label: 'Face Order',
        required: false,
        default: 'large-small',
        options: [
          { value: 'large-small', text: 'large-small' },
          { value: 'left-right', text: 'left-right' },
        ],
      },
    ],
    tasks: [
      {
        handler: getFilesWithFolderName,
      },
      {
        forEach: {
          items: '{{files}}',
          as: 'file',
        },
        tasks: [
          {
            handler: prepareComfyFsvFile,
            outputAs: 'prepResult',
          },
          {
            condition: '{{prepResult.shouldProcess}}',
            tasks: [
              {
                handler: buildComfyFsvWorkflowInputs,
                outputAs: 'wfInputs',
              },
              {
                taskName: 'Run ComfyUI Workflow',
                inputs: {
                  workflowPath: '{{wfInputs.workflowPath}}',
                  params: '{{wfInputs.params}}',
                  outputKey: '{{wfInputs.outputKey}}',
                },
                outputAs: 'comfyResult',
              },
              {
                handler: postProcessComfyFsv,
              },
            ],
          },
        ],
        combineResults: 'array',
      },
    ],
  },
}
