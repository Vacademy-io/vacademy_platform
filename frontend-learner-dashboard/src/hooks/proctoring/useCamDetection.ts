export {};
// import { useCallback, useEffect, useRef, useState } from "react";
// import { isMobile } from "react-device-detect";
// import { playVideo } from "shared/helpers";

// export type Status = "on" | "off" | "blocked";

// type Props = {
//   disabled?: boolean;
// };

// export function useCamDetection({ disabled }: Props = { disabled: false }) {
//   const [webCamStatus, setWebCamStatus] = useState<Status | null>(null);

//   const videoRef = useRef<HTMLVideoElement>(null);

//   /**
//    * To get all the input devices list and check their permissions
//    * if label of videoinput is empty means that permission to access that device is not granted
//    */
//   const getPermissions = () => {
//     navigator.mediaDevices
//       .enumerateDevices()
//       .then((data) => {
//         if (
//           data
//             .filter(({ kind }) => kind === "videoinput")
//             .some(({ label }) => label === "")
//         ) {
//           setWebCamStatus("blocked");
//         } else {
//           /**
//            * Phone does not allow to re-initiate this request
//            */
//           if (isMobile) {
//             setWebCamStatus("on");
//           } else {
//             navigator.mediaDevices
//               .getUserMedia({ video: true })
//               .then(() => {
//                 setWebCamStatus("on");
//               })
//               .catch((err) => {
//                 setWebCamStatus("blocked");
//                 return;
//               });
//           }
//         }
//       })
//       .catch((err) => console.error(err));
//   };

//   useEffect(() => {
//     // if proctoring is disabled then simply return
//     if (disabled) return;

//     // if user has given permission for camera, video is played
//     if (webCamStatus === "on") playVideo(videoRef);
//   }, [disabled, videoRef, webCamStatus]);

//   /**
//    * if user pauses the video then video is forced to replay
//    */
//   const replayVideo = useCallback(() => {
//     if (disabled) return;

//     const video = videoRef.current;
//     if (webCamStatus === "off") {
//       video?.play();
//       setWebCamStatus("on");
//     }
//   }, [webCamStatus, disabled]);

//   useEffect(() => {
//     /**
//      * on every reload call this before enumerateDevices()
//      * otherwise it will return empty array and webCamStatus will always stay blocked
//      */
//     let getPermissionsInterval: ReturnType<typeof setInterval>;

//     const requestCam = async () => {
//       try {
//         await navigator.mediaDevices.getUserMedia({ video: true });
//       } catch (e) {
//         console.error("Camera permission blocked");
//       }

//       getPermissions();
//       // Check camera permissions every minute
//       getPermissionsInterval = setInterval(getPermissions, 60 * 1000);
//     };

//     if (!disabled) {
//       requestCam();
//     }

//     return () => {
//       clearInterval(getPermissionsInterval);
//     };
//   }, [disabled]);

//   return {
//     webCamStatus,
//     videoRef,
//     replayVideo,
//   } as const;
// }
