// Existing assets
import pmPlaceholder from './pm-placeholder.json';
import pmAnalyzeMeeting from './pm-analyzeMeeting.json';
import pmExecuteJiraActions from './pm-executeJiraActions.json';
import pmExecuteGithubActions from './pm-executeGithubActions.json';
import pmSendNotifications from './pm-sendNotifications.json';
import pmFullWorkflow from './pm-fullWorkflow.json';

// Wave 1 — execution assets
import pmExecuteLinearActions from './pm-executeLinearActions.json';
import pmExecuteAzureDevOpsActions from './pm-executeAzureDevOpsActions.json';
import pmWriteConfluencePages from './pm-writeConfluencePages.json';
import pmSendTeamsNotifications from './pm-sendTeamsNotifications.json';
import pmSendEmailNotifications from './pm-sendEmailNotifications.json';
import pmCreatePagerDutyIncidents from './pm-createPagerDutyIncidents.json';
import pmLinkSentryIssues from './pm-linkSentryIssues.json';
import pmExecuteGitLabActions from './pm-executeGitLabActions.json';
import pmScheduleCalendarEvents from './pm-scheduleCalendarEvents.json';

// Wave 1 — meeting intelligence fetch assets
import pmFetchGranolaNote from './pm-fetchGranolaNote.json';
import pmFetchFathomSummary from './pm-fetchFathomSummary.json';
import pmFetchFirefliesTranscript from './pm-fetchFirefliesTranscript.json';
import pmFetchOtterTranscript from './pm-fetchOtterTranscript.json';
import pmFetchTldvHighlights from './pm-fetchTldvHighlights.json';
import pmFetchAvomaSummary from './pm-fetchAvomaSummary.json';
import pmFetchReadSummary from './pm-fetchReadSummary.json';
import pmFetchZoomAISummary from './pm-fetchZoomAISummary.json';
import pmFetchTeamsMeetingSummary from './pm-fetchTeamsMeetingSummary.json';

// All PM asset definitions to be deployed to the venue on connect
const pmAssets: object[] = [
  // Core
  pmPlaceholder,
  pmAnalyzeMeeting,
  pmExecuteJiraActions,
  pmExecuteGithubActions,
  pmSendNotifications,
  pmFullWorkflow,
  // Wave 1 — execution
  pmExecuteLinearActions,
  pmExecuteAzureDevOpsActions,
  pmWriteConfluencePages,
  pmSendTeamsNotifications,
  pmSendEmailNotifications,
  pmCreatePagerDutyIncidents,
  pmLinkSentryIssues,
  pmExecuteGitLabActions,
  pmScheduleCalendarEvents,
  // Wave 1 — meeting intelligence
  pmFetchGranolaNote,
  pmFetchFathomSummary,
  pmFetchFirefliesTranscript,
  pmFetchOtterTranscript,
  pmFetchTldvHighlights,
  pmFetchAvomaSummary,
  pmFetchReadSummary,
  pmFetchZoomAISummary,
  pmFetchTeamsMeetingSummary,
];

export default pmAssets;

export {
  pmPlaceholder,
  pmAnalyzeMeeting,
  pmExecuteJiraActions,
  pmExecuteGithubActions,
  pmSendNotifications,
  pmFullWorkflow,
  pmExecuteLinearActions,
  pmExecuteAzureDevOpsActions,
  pmWriteConfluencePages,
  pmSendTeamsNotifications,
  pmSendEmailNotifications,
  pmCreatePagerDutyIncidents,
  pmLinkSentryIssues,
  pmExecuteGitLabActions,
  pmScheduleCalendarEvents,
  pmFetchGranolaNote,
  pmFetchFathomSummary,
  pmFetchFirefliesTranscript,
  pmFetchOtterTranscript,
  pmFetchTldvHighlights,
  pmFetchAvomaSummary,
  pmFetchReadSummary,
  pmFetchZoomAISummary,
  pmFetchTeamsMeetingSummary,
};
