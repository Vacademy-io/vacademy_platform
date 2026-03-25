export async function onRequestPost(context) {
  try {
    const SLACK_WEBHOOK_URL = context.env.SLACK_WEBHOOK_URL;
    if (!SLACK_WEBHOOK_URL) return new Response("Missing Slack URL", { status: 500 });

    const payload = await context.request.json();
    let slackMessage = null; // Default to null (don't send anything)

    // ==========================================
    // SCENARIO 1: Real Sentry Crash
    // ==========================================
    if (payload.data && payload.data.issue) {
      const issue = payload.data.issue;
      const project = issue.project ? issue.project.name : "Unknown Project";

      slackMessage = {
        blocks: [
          {
            type: "header",
            text: {
              type: "plain_text",
              text: "🚨 New Exception Detected",
              emoji: true
            }
          },
          {
            type: "section",
            fields: [
              {
                type: "mrkdwn",
                text: `*Project:*\n${project}`
              },
              {
                type: "mrkdwn",
                text: `*Level:*\n${issue.level || "Error"}`
              }
            ]
          },
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: `*Error:* <${issue.permalink}|${issue.title}>\n\`${issue.culprit || "No stacktrace"}\``
            }
          },
          {
            type: "divider"
          }
        ]
      };
    }

    // ==========================================
    // SCENARIO 2: User Manually Reported an Issue
    // ==========================================
    else if (payload.errorDetails) {
      slackMessage = {
        blocks: [
          {
            type: "header",
            text: {
              type: "plain_text",
              text: "🗣️ User Reported Issue",
              emoji: true
            }
          },
          {
            type: "section",
            fields: [
              {
                type: "mrkdwn",
                text: `*Reporter:*\n${payload.userEmail || "Anonymous"}`
              },
              {
                type: "mrkdwn",
                text: `*Time:*\n${new Date().toLocaleTimeString()}`
              }
            ]
          },
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: `*Feedback:*\n${payload.errorDetails}`
            }
          },
          {
            type: "divider"
          }
        ]
      };
    }

    // ==========================================
    // SCENARIO 3: Noise (Ignore)
    // ==========================================
    if (!slackMessage) {
      // Return 200 OK to keep Sentry happy, but send NO message to Slack
      return new Response("Ignored noise", { status: 200 });
    }

    // Send to Slack
    const slackResponse = await fetch(SLACK_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(slackMessage),
    });

    return new Response("Alert Sent", { status: 200 });

  } catch (err) {
    return new Response(`Error: ${err.message}`, { status: 500 });
  }
}
