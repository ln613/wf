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
      condition: {
        subjectPattern: 'FW:\\s*CARO.*Work Order',
        attachments: {
          minCount: 2,
          requiredTypes: ['excel', 'pdf'],
        },
      },
      inputMapping: {
        pdfPath: {
          from: 'email.attachments',
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
        name: 'filePath',
        type: 'string',
        label: 'File Path',
        required: true,
      },
      {
        name: 'start',
        type: 'number',
        label: 'Start Time (seconds)',
        required: false,
      },
      {
        name: 'end',
        type: 'number',
        label: 'End Time (seconds)',
        required: false,
      },
    ],
    tasks: [
      {
        taskName: 'KS Cut Process',
        inputs: {
          filePath: '{{filePath}}',
          start: '{{start}}',
          end: '{{end}}',
        },
        outputAs: 'result',
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
        name: 'filePath',
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
    ],
    tasks: [
      {
        taskName: 'Comfy FSV Process',
        inputs: {
          type: '{{type}}',
          filePath: '{{filePath}}',
          count: '{{count}}',
        },
        outputAs: 'result',
      },
    ],
    outputs: ['success', 'results', 'message'],
    outputMapping: {
      success: '{{result.success}}',
      results: '{{result.results}}',
      message: '{{result.message}}',
    },
  },
}
