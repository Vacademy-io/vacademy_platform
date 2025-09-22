package vacademy.io.admin_core_service.features.notification_service.utils;

public class ReferralsEmailBody {

    // Email body for the referrer (person who invited)
    public static final String REFERRER_EMAIL_BODY = """
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Your Referral Reward</title>
  </head>
  <body>
    <h2>Thank you for your referral!! </h2>
    <p>Hi <strong>{{REFERRER_NAME}}</strong>,</p>
    <p>Thanks for referring <strong>{{REFEREE_NAME}}</strong> to our community. As a token of our appreciation, we've unlocked the following exclusive content for you:</p>
    <ul>
      {{CONTENT_LINKS}}
    </ul>
    <p>We appreciate you being part of the {{INSTITUTE_NAME}} family!</p>
    <p><a href="{{INSTITUTE_URL}}">{{INSTITUTE_NAME}}</a></p>
    <p>{{INSTITUTE_ADDRESS}}</p>
  </body>
</html>
""";


    public static final String REFEREE_EMAIL_BODY = """
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Welcome to {{INSTITUTE_NAME}}!</title>
  </head>
  <body>
    <h2>Welcome to {{INSTITUTE_NAME}}! </h2>
    <p>Hi <strong>{{REFEREE_NAME}}</strong>,</p>
    <p>You were invited by <strong>{{REFERRER_NAME}}</strong> to join us. To help you get started, we've prepared some exclusive content just for you:</p>
    <ul>
      {{CONTENT_LINKS}}
    </ul>
    <p>We're excited to have you with us. Enjoy your journey!</p>
    <p><a href="{{INSTITUTE_URL}}">{{INSTITUTE_NAME}}</a></p>
    <p>{{INSTITUTE_ADDRESS}}</p>
  </body>
</html>
""";

}
