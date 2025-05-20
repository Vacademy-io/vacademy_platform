// import { SsdcLogo_Login } from "@/assets/svgs"; // Add the logo here
import Logo from "@/svgs/ssdc-logo.svg"

export default function HeaderLogo() {
  return (
    <div>
    <div className=" flex flex-col w-full items-center justify-center" style={{ padding: '6%' }}>
      <Logo />
    </div>
    </div>
  );
}
