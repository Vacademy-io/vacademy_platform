import { MyButton } from "@/components/design-system/button";

export const PublishTab = () => {
    return (
        <div className="border-b">
            <div className="mx-8 my-4 flex flex-row items-center justify-between">
                <div className="text-h3">Collaborative Corner : Share and Explore</div>
                <div>
                    <MyButton>Publish</MyButton>
                </div>
            </div>
        </div>
    );
};
