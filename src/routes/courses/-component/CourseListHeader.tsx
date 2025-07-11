import { useState, useEffect } from "react";
import { getPublicUrlWithoutLogin } from "@/services/upload_file";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { LoginForm } from "@/components/common/LoginPages/sections/login-form";

const CourseListHeader = ({
    fileId,
    instituteId,
    type,
    courseId,
}: {
    fileId?: string;
    instituteId?: string;
    type?: string;
    courseId?: string;
}) => {
    const [imgUrl, setImgUrl] = useState("");
    const [logoLoading, setLogoLoading] = useState<boolean>(false);

    useEffect(() => {
        setLogoLoading(true);
        const fetchDynamicLogo = async () => {
            try {
                const url = await getPublicUrlWithoutLogin(fileId);
                setImgUrl(url);
            } catch (error) {
                console.log(error);
            } finally {
                setLogoLoading(false);
            }
        };

        fetchDynamicLogo();
    }, [instituteId]);

    return (
        <nav className="min-h-[80px] bg-white py-5 px-6 md:px-10 flex flex-col md:flex-row justify-between items-center shadow-sm">
            <div className="flex items-center relative h-10 w-24 mr-3 mb-4 md:mb-0">
                {logoLoading && (
                    <div
                        className="absolute inset-0 bg-gray-200 rounded-md border border-gray-200 flex items-center justify-center text-gray-400 text-xs"
                        aria-label="Loading logo"
                    >
                        Loading...
                    </div>
                )}
                <img
                    src={imgUrl}
                    alt={`logo`}
                    className={`h-full w-full object-contain rounded-md border border-gray-200 ${logoLoading ? "opacity-0" : "opacity-100"}`}
                />
            </div>

            <div className="flex flex-col md:flex-row items-center gap-6">
                <ul className="flex flex-wrap justify-center md:justify-start items-center gap-4 text-gray-800 mb-4 md:mb-0">
                    <li>
                        <a
                            href="#home"
                            className="hover:text-blue-600 transition"
                        >
                            Home
                        </a>
                    </li>
                    <li>
                        <a
                            href="#about"
                            className="hover:text-blue-600 transition"
                        >
                            About
                        </a>
                    </li>
                    <li>
                        <a
                            href="#impact"
                            className="hover:text-blue-600 transition"
                        >
                            Impact
                        </a>
                    </li>
                    <li>
                        <a
                            href="#courses"
                            className="hover:text-blue-600 transition"
                        >
                            Courses
                        </a>
                    </li>
                    <li>
                        <a
                            href="#involved"
                            className="hover:text-blue-600 transition"
                        >
                            Get Involved
                        </a>
                    </li>
                    <li>
                        <a
                            href="#contact"
                            className="hover:text-blue-600 transition"
                        >
                            Contact
                        </a>
                    </li>
                </ul>
                <div className="flex gap-3">
                    <Dialog>
                        <DialogTrigger>
                            <button className="px-3 py-2 border border-1 border-gray-300  text-black rounded-md hover:bg-gray-100 transition">
                                Login
                            </button>
                        </DialogTrigger>
                        <DialogContent>
                            <LoginForm type={type} courseId={courseId} />
                        </DialogContent>
                    </Dialog>
                    <button className="px-3 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition">
                        Donate
                    </button>
                </div>
            </div>
        </nav>
    );
};

export default CourseListHeader;
