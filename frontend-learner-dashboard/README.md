# Template App

## Important

1. Use the recommended extensions
1. Sometimes vscode might not pick up the terminal env variable and you might get `Environment variable not found` errors, In those cases open the vscode using your native terminal app instead of GUI.
1. Use your physical android / ios device for development it is always faster : Steps to set up debugging on physical device : [LINK](https://developer.android.com/codelabs/basic-android-kotlin-compose-connect-device#0)

## Initial (one-time) setup :

1. Install `nvm` to manage node versions, Make sure you are using Node.JS `v21.0.0`
1. Install `pnpm` from [LINK](https://pnpm.io/)
1. Make sure that your vs-code is using the same typescript version as the current project
1. Run `pnpm install` to install dependencies
1. Install ionic cli : `npm i -g @ionic/cli`
1. Download Java21 using [this](https://www.oracle.com/in/java/technologies/downloads/#java21)
1. Make sure your `JAVA_HOME` variable is properly configured and pointing to Java21

   Example :

   ```sh
   export JAVA_HOME=/usr/lib/jvm/jdk-21-oracle-x64
   ```

1. Install JetBrains Toolbox : [LINK](https://www.jetbrains.com/toolbox-app/)
1. Using JetBrains Toolbox install Android studio
1. Set up Android Studio: use default installation (It will download some SDKs and default Emulator)

1. Capacitor android studio linkage :

   - Open you JetBrains toolbox
   - click on tool actions menu (⋮) (three dots on android studio)
   - select settings
   - copy the installation path
     e.g. `/home/anurag/.local/share/JetBrains/Toolbox/apps/android-studio`

   - Add this environment variable `CAPACITOR_ANDROID_STUDIO_PATH` as location of your android studio app (Make sure you see an executable in /bin directory of the installation path in previous point):

   **For Windows** : `{android-studio-location}\bin\studio64.exe`
   **For Linux OR Mac** : `{android-studio-location}/bin/studio.sh`

   - Example

   ```sh
   export CAPACITOR_ANDROID_STUDIO_PATH=/home/anurag/.local/share/JetBrains/Toolbox/apps/android-studio/bin/studio.sh
   ```

1. Set up `ANDROID_SDK_ROOT` :

   - Open Android studio
   - Click on settings
   - Go to SDK Manager
   - Copy the Android SDK Location
   - Set `ANDROID_SDK_ROOT` to the copied path

   Example

   ```sh
   export ANDROID_SDK_ROOT=/home/anurag/Android/Sdk
   ```

## Running the project with android

### With Live Reload (Recommended)

- Run the vite dev server using `pnpm run dev` (keep this terminal open throughout the duration of session)
- After running the server you will receive network address of your app
  example :

```sh
  VITE v5.2.11  ready in 205 ms

  ➜  Local:   http://localhost:5173/
  ➜  Network: http://192.168.1.42:5173/
  ➜  Network: http://192.168.1.34:5173/
  ➜  press h + enter to show help
```

- Go to `capacitor.config.ts` file in project's root and uncomment the commented server block and paste the Newtwork URL from previous step

- Open up a new terminal (Keep the pnpm run dev terminal running)
- Running the Emulator

  - To run on android use `npx cap run android`, For ios use `npx cap run ios`
  - Above command will open the emulator which was installed with your android studio. If the above command fails you can open the `/android` folder in Android studio, wait for gradle to build it and then run it from RUN button It will open the emulator inside Android studio

- How to debug running app? : https://stackoverflow.com/questions/60792611/capacitor-compiled-ionic-app-how-to-debug-in-android-studio

## Recommended extensions

1. `gruntfuggly.todo-tree`
1. `dsznajder.es7-react-js-snippets`
1. `eamodio.gitlens`
1. `christian-kohler.path-intellisense`
1. `esbenp.prettier-vscode`
1. `bradlc.vscode-tailwindcss`
