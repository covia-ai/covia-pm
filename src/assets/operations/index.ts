import pmPlaceholder from './pm-placeholder.json';
import pmAnalyzeMeeting from './pm-analyzeMeeting.json';
import pmExecuteJiraActions from './pm-executeJiraActions.json';
import pmExecuteGithubActions from './pm-executeGithubActions.json';
import pmSendNotifications from './pm-sendNotifications.json';
import pmFullWorkflow from './pm-fullWorkflow.json';

// All PM asset definitions to be deployed to the venue
const pmAssets: object[] = [
  pmPlaceholder,
  pmAnalyzeMeeting,
  pmExecuteJiraActions,
  pmExecuteGithubActions,
  pmSendNotifications,
  pmFullWorkflow,
];

export default pmAssets;

// Named exports for direct access
export {
  pmPlaceholder,
  pmAnalyzeMeeting,
  pmExecuteJiraActions,
  pmExecuteGithubActions,
  pmSendNotifications,
  pmFullWorkflow,
};
