import { LayoutContainer } from "@/components/common/layout-container/layout-container";
import { MyButton } from "@/components/design-system/button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useNavHeadingStore } from "@/stores/layout-container/useNavHeadingStore";
import { createFileRoute } from "@tanstack/react-router";
import { Mail } from "lucide-react";
import { Copy, Plus, X } from "phosphor-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/referral/")({
  component: () => {
    return (
      <LayoutContainer>
        <ReferralComponent />
      </LayoutContainer>
    );
  },
});

function ReferralComponent() {
  const [emailInput, setEmailInput] = useState("");
  const [emailList, setEmailList] = useState(["user@gmail.com"]);
  const { setNavHeading } = useNavHeadingStore();
  useEffect(() => {
    setNavHeading("My Referrals");
  }, []);

  const referralLink = "shreyashjain/referral/bhdshad";
  const referralCode = "AD123456";

  const referrals = [
    { date: "01/06/2025", memberName: "Aarav Sharma", referralNumber: 1 },
    { date: "01/06/2025", memberName: "Aarav Sharma", referralNumber: 2 },
    { date: "01/06/2025", memberName: "Aarav Sharma", referralNumber: 3 },
    { date: "01/06/2025", memberName: "Aarav Sharma", referralNumber: 4 },
  ];

  const copyToClipboard = (text: string, type: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${type} copied to clipboard`);
  };

  const addEmail = () => {
    if (
      emailInput &&
      emailInput.includes("@") &&
      !emailList.includes(emailInput)
    ) {
      setEmailList([...emailList, emailInput]);
      setEmailInput("");
    }
  };

  const removeEmail = (email: string) => {
    setEmailList(emailList.filter((e) => e !== email));
  };

  const sendInvites = () => {
    toast.success(
      `Sent invitations to ${emailList.length} email${
        emailList.length > 1 ? "s" : ""
      }`
    );
  };

  return (
    <div className="min-h-screen ">
      {/* Desktop: Two-column hero layout, Mobile: Stacked */}
      <div className="container mx-auto px-4 py-8 lg:py-16">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center mb-16">
          {/* Left Column - Content */}
          <div className="space-y-8 lg:pr-8">
            <div className="space-y-6">
              <h1 className="text-3xl lg:text-4xl xl:text-5xl font-bold text-gray-800 leading-tight">
                Invite friends,
                <br />
                get rewards
              </h1>
              <p className="text-lg text-gray-600 leading-relaxed">
                Share the gift of wellness with your friends and earn rewards
                for both of you.
              </p>
            </div>

            <div className="rounded-xl border p-6 lg:p-8">
              <p className="text-gray-700 text-base leading-relaxed">
                Share your code with friends, and they'll get a free bonuses or
                discounts. Once 10 of your friends have signed up through your
                referral link, you'll also receive a free month.
              </p>
            </div>
          </div>

          <div className="flex justify-center lg:justify-end">
            <div className="relative w-full max-w-lg">
              <img
                src="/meditation.png"
                alt="Meditation illustration with person in lotus pose surrounded by plants"
                width={500}
                height={500}
                className="w-full h-auto"
              />
            </div>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-3 mb-12">
          <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-lg lg:col-span-1">
            <CardHeader className="pb-4">
              <CardTitle className="text-lg font-semibold text-gray-800">
                Invite Link
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex gap-2">
                  <Input
                    value={referralLink}
                    readOnly
                    className="bg-gray-50 border-gray-200 text-sm"
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => copyToClipboard(referralLink, "Invite link")}
                    className="shrink-0"
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
                <p className="text-sm text-gray-500">
                  Share this link with your friends
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-lg lg:col-span-1">
            <CardHeader className="pb-4">
              <CardTitle className="text-lg font-semibold text-gray-800">
                Invite Code
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex gap-2">
                  <Input
                    value={referralCode}
                    readOnly
                    className="bg-gray-50 border-gray-200 text-sm font-mono"
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => copyToClipboard(referralCode, "Invite code")}
                    className="shrink-0"
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
                <p className="text-sm text-gray-500">
                  Friends can enter this code
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-lg lg:col-span-1">
            <CardHeader className="pb-4">
              <CardTitle className="text-lg font-semibold text-gray-800">
                Email Invites
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <Input
                  placeholder="user15@email.com"
                  value={emailInput}
                  onChange={(e) => setEmailInput(e.target.value)}
                  onKeyPress={(e) => e.key === "Enter" && addEmail()}
                  className="flex-1 text-sm"
                />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={addEmail}
                  className="shrink-0 bg-transparent"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>

              {emailList.length > 0 && (
                <div className="space-y-2 max-h-24 overflow-y-auto">
                  {emailList.map((email, index) => (
                    <Badge
                      key={index}
                      variant="secondary"
                      className="flex items-center justify-between w-full px-3 py-1"
                    >
                      <span className="text-xs truncate">{email}</span>
                      <button
                        onClick={() => removeEmail(email)}
                        className="ml-2 hover:bg-gray-200 rounded-full p-0.5"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}

              <MyButton
                onClick={sendInvites}
                disabled={emailList.length === 0}
                className="w-full"
                size="sm"
              >
                <Mail className="h-4 w-4 mr-2" />
                Send Invite
              </MyButton>
            </CardContent>
          </Card>
        </div>

        <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-lg">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg font-semibold text-gray-800">
                Your Referrals
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table className="">
                <TableHeader>
                  <TableRow className="text-black bg-primary-100">
                    <TableHead className="text-black">Date</TableHead>
                    <TableHead className="text-black">Member Name</TableHead>
                    <TableHead className="text-black text-center">
                      Referral #
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {referrals.map((referral, index) => (
                    <TableRow key={index}>
                      <TableCell className="font-medium">
                        {referral.date}
                      </TableCell>
                      <TableCell className="font-medium">
                        {referral.memberName}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="secondary">
                          {referral.referralNumber}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
