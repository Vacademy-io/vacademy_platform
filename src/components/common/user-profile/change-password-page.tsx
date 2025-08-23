import AccountDetailsEdit from "./account-details-edit";

const ChangePasswordPage = () => {
  return (
    <div className="bg-white relative rounded-lg h-screen w-full max-w-md mx-auto shadow-lg sm:max-w-md md:max-w-lg lg:max-w-xl">
      <AccountDetailsEdit isModal={false} />
    </div>
  );
};

export default ChangePasswordPage;
