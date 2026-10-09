import { describe, expect, it } from "vitest";
import { AxiosError, AxiosHeaders } from "axios";
import { checkoutErrorOf } from "./checkout-error";

const axiosError = (status: number, data: unknown) => {
  const err = new AxiosError(`Request failed with status code ${status}`);
  err.response = { status, data, statusText: "", headers: {}, config: { headers: new AxiosHeaders() } };
  return err;
};

describe("checkoutErrorOf", () => {
  it("shows the server's explanation instead of the transport message", () => {
    expect(checkoutErrorOf(axiosError(510, { ex: "Payment amount mismatch" }), "Failed", "Changed")).toEqual({
      message: "Payment amount mismatch",
      priceChanged: false,
    });
  });

  it("flags a 409 as a changed price, with the server message or a fallback", () => {
    const msg = "The price of a course in your cart has changed. Please reload the page and try again.";
    expect(checkoutErrorOf(axiosError(409, { message: msg }), "Failed", "Changed")).toEqual({ message: msg, priceChanged: true });
    expect(checkoutErrorOf(axiosError(409, {}), "Failed", "Changed")).toEqual({ message: "Changed", priceChanged: true });
  });

  it("keeps the old behaviour for everything else", () => {
    expect(checkoutErrorOf(axiosError(500, "<html>oops</html>"), "Failed", "Changed").message).toBe("Request failed with status code 500");
    expect(checkoutErrorOf(new Error("Network Error"), "Failed", "Changed").message).toBe("Network Error");
    expect(checkoutErrorOf("weird", "Failed", "Changed").message).toBe("Failed");
  });
});
