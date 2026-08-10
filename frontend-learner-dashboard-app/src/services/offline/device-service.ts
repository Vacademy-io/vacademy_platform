/**
 * Device registry client (plan §A3 / §B6 "device-service.ts"). Mirrors
 * admin_core_service's LearnerOfflineDeviceController + OfflineDeviceDTO /
 * OfflineDeviceRegisterRequest exactly (snake_case JSON).
 *
 * Registration uses `@capacitor/device`'s `Device.getId()` as the stable
 * client-reported id (`OfflineDeviceRegisterRequest.device_id` — the server
 * calls this `client_device_id` internally) and `Device.getInfo()` for a
 * human name/platform. On success the caller (useOfflineCheckin) upserts the
 * local `device_state` row with the server-issued `id` as
 * `device_registration_id`.
 */

import { Device } from "@capacitor/device";
import authenticatedAxiosInstance from "@/lib/auth/axiosInstance";
import { OFFLINE_DEVICES_URL } from "@/constants/urls";
import { getInstituteId } from "@/constants/helper";

export type OfflineDeviceStatus = "ACTIVE" | "REVOKED";

export interface OfflineDeviceDTO {
  id: string;
  device_name: string | null;
  platform: string | null;
  status: OfflineDeviceStatus;
  client_device_id: string | null;
  lease_expires_at: number | string | null;
  last_checkin_at: number | string | null;
  registered_at: number | string | null;
  revoked_at: number | string | null;
  revoke_reason: string | null;
}

/** Thrown by download-manager's enqueue seam when registration hits the device cap, so the UI can show device-management + retry. */
export class DeviceLimitReachedError extends Error {
  readonly devices: OfflineDeviceDTO[];
  constructor(devices: OfflineDeviceDTO[], message: string) {
    super(message);
    this.name = "DeviceLimitReachedError";
    this.devices = devices;
  }
}

export type RegisterResult =
  | { status: "registered"; device: OfflineDeviceDTO }
  | { status: "limit_reached"; devices: OfflineDeviceDTO[]; message: string }
  | { status: "error"; message: string };

/** Builds the stable client device id + a friendly name/platform from the native Device plugin. */
async function getDeviceIdentity(): Promise<{ deviceId: string; deviceName: string; platform: string }> {
  const [id, info] = await Promise.all([Device.getId(), Device.getInfo()]);
  const deviceName = info.name || `${info.model ?? info.platform} device`;
  return { deviceId: id.identifier, deviceName, platform: info.platform };
}

/** POST /devices/register. On 409 DEVICE_LIMIT_REACHED, surfaces the current device list so the UI can offer self-revoke + retry. */
export async function registerDevice(): Promise<RegisterResult> {
  try {
    const [instituteId, identity] = await Promise.all([getInstituteId(), getDeviceIdentity()]);
    const response = await authenticatedAxiosInstance.post<OfflineDeviceDTO>(
      `${OFFLINE_DEVICES_URL}/register`,
      { device_name: identity.deviceName, platform: identity.platform, device_id: identity.deviceId },
      { params: { instituteId } }
    );
    return { status: "registered", device: response.data };
  } catch (error) {
    const axiosError = error as {
      response?: { status?: number; data?: { code?: string; message?: string; devices?: OfflineDeviceDTO[] } };
      message?: string;
    };
    if (axiosError.response?.status === 409 && axiosError.response.data?.code === "DEVICE_LIMIT_REACHED") {
      return {
        status: "limit_reached",
        devices: axiosError.response.data.devices ?? [],
        message: axiosError.response.data.message ?? "Maximum offline devices reached.",
      };
    }
    return { status: "error", message: axiosError.message ?? "Failed to register this device for offline access." };
  }
}

/** GET /devices — current user's registered devices. */
export async function listDevices(): Promise<OfflineDeviceDTO[]> {
  const instituteId = await getInstituteId();
  const response = await authenticatedAxiosInstance.get<OfflineDeviceDTO[]>(OFFLINE_DEVICES_URL, {
    params: { instituteId },
  });
  return response.data;
}

/** DELETE /devices/{id} — self-revoke (e.g. to free a slot under the device cap). */
export async function selfRevokeDevice(deviceId: string): Promise<void> {
  await authenticatedAxiosInstance.delete(`${OFFLINE_DEVICES_URL}/${deviceId}`);
}
