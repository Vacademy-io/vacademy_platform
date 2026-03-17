# Runpod Setup
To obtain the `RUNPOD_ENDPOINT_ID`:
1. Log in to your **RunPod Console** at [https://www.runpod.io/console/serverless](https://www.runpod.io/console/serverless).
2. Go to the **Serverless** tab from the left sidebar.
3. Once you deploy an endpoint for the **EchoMimic** inference API (either from a custom template or a pre-configured RunPod environment), you will see it listed under your **Endpoints**.
4. The **`RUNPOD_ENDPOINT_ID`** is the unique alphanumeric ID located immediately next to the endpoint name.

Example: If your endpoint is `yourcustomendpoint (xyz123abc456)`, then `xyz123abc456` is what you'll copy over for `RUNPOD_ENDPOINT_ID`. 

(Alternatively, if you click into the *Endpoint Details*, look directly at the URL paths: `https://api.runpod.ai/v2/xyz123abc456/run`, which corresponds again to `xyz123abc456`).
