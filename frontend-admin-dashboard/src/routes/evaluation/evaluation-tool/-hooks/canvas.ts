import { Canvas, Textbox, IText, Rect, Circle, PencilBrush } from "fabric";
import { useState } from "react";
import { toast } from "sonner";

const useFabric = (fabricCanvas: Canvas | null) => {
    const [isDrawingMode, setIsDrawingMode] = useState(false);
    const [penColor, setPenColor] = useState("black");
    const addSymbol = async (symbol: string, color: string): Promise<void> => {
        if (!fabricCanvas) return;
        const text = new IText(symbol, {
            left: 100,
            top: window.scrollY ?? 100,
            fontSize: 60,
            fill: color,
            selectable: true,
            editable: false,
        });
        fabricCanvas.add(text);
        fabricCanvas.requestRenderAll();
    };

    const addTextBox = async (): Promise<void> => {
        if (!fabricCanvas) return;
        const textbox = new Textbox("Add Comment", {
            left: 100,
            top: window.scrollY ?? 100,
            width: 100,
            fontSize: 20,
            fill: "black",
            backgroundColor: "#f2eeed",
            selectable: true,
        });
        fabricCanvas.add(textbox);
        fabricCanvas.requestRenderAll();
    };

    const addPenTool = async (color: string = "black"): Promise<void> => {
        if (!fabricCanvas) return;
        console.log("drawing mode");
        setIsDrawingMode(() => true);
        fabricCanvas.isDrawingMode = true;
        fabricCanvas.freeDrawingBrush = new PencilBrush(fabricCanvas);
        fabricCanvas.freeDrawingBrush.color = color;
        fabricCanvas.freeDrawingBrush.width = 5;
        fabricCanvas.requestRenderAll();
        setPenColor(color);
    };

    const clearCanvas = (): void => {
        if (!fabricCanvas) return;
        fabricCanvas.clear();
        fabricCanvas.requestRenderAll();
    };

    const disableDrawingMode = (): void => {
        if (!fabricCanvas) return;
        fabricCanvas.isDrawingMode = false;
        setIsDrawingMode(false);
        setPenColor("black");
    };

    const addNumber = async (num: string): Promise<void> => {
        if (!fabricCanvas) return;
        const text = new IText(num, {
            left: 100,
            top: window.scrollY ?? 100,
            fontSize: 50,
            fill: "blue",
            selectable: true,
            editable: false,
        });
        fabricCanvas.add(text);
        fabricCanvas.requestRenderAll();
    };

    const addRectangle = async (): Promise<void> => {
        const rect = new Rect({
            left: 100,
            top: window.scrollY ?? 100,
            width: 100,
            height: 50,
            angle: 0,
            fill: "transparent",
            stroke: "black",
            strokeWidth: 2,
            selectable: true,
            editable: false,
        });
        fabricCanvas?.add(rect);
        fabricCanvas?.renderAll();
    };

    const addCircle = async (): Promise<void> => {
        const circle = new Circle({
            left: 100,
            top: window.scrollY ?? 100,
            radius: 50,
            fill: "transparent",
            stroke: "red",
            strokeWidth: 2,
            selectable: true,
            editable: false,
        });
        fabricCanvas?.add(circle);
        fabricCanvas?.renderAll();
    };

    function deleteSelectedShape() {
        const activeObject = fabricCanvas?.getActiveObject();
        if (activeObject && fabricCanvas) {
            fabricCanvas.remove(activeObject);
            fabricCanvas.discardActiveObject();
            fabricCanvas.renderAll();
        } else {
            toast.error("Please select an item to delete");
            console.log("No shape selected to delete.");
        }
    }

    return {
        isDrawingMode,
        setIsDrawingMode,
        penColor,
        setPenColor,
        addSymbol,
        addTextBox,
        addPenTool,
        clearCanvas,
        disableDrawingMode,
        addNumber,
        addRectangle,
        addCircle,
        deleteSelectedShape,
    };
};

export default useFabric;
