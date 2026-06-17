import { Canvas, Textbox, IText, Rect, Circle, PencilBrush, Path } from 'fabric';
import { useState } from 'react';
import { toast } from 'sonner';

const useFabric = (fabricCanvas: Canvas | null) => {
    const [isDrawingMode, setIsDrawingMode] = useState(false);
    // Default pen colour is green (the common "tick / correct" annotation colour).
    const [penColor, setPenColor] = useState('green');
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
        const textbox = new Textbox('Add Comment', {
            left: 100,
            top: window.scrollY ?? 100,
            width: 100,
            fontSize: 20,
            fill: 'black',
            backgroundColor: '#f2eeed', // design-lint-ignore: fabric.js textbox fill — a canvas color value, not a CSS token
            selectable: true,
        });
        fabricCanvas.add(textbox);
        fabricCanvas.requestRenderAll();
    };

    const addPenTool = async (color: string = 'green'): Promise<void> => {
        if (!fabricCanvas) return;
        setIsDrawingMode(() => true);
        fabricCanvas.isDrawingMode = true;
        fabricCanvas.freeDrawingBrush = new PencilBrush(fabricCanvas);
        fabricCanvas.freeDrawingBrush.color = color;
        fabricCanvas.freeDrawingBrush.width = 5;
        fabricCanvas.requestRenderAll();
        setPenColor(color);
    };

    // Selection / cursor mode — exit drawing so the evaluator can click, move and
    // resize any annotation that's already on the page.
    const enableSelection = (): void => {
        if (!fabricCanvas) return;
        fabricCanvas.isDrawingMode = false;
        setIsDrawingMode(false);
        fabricCanvas.selection = true;
        fabricCanvas.forEachObject((obj) => {
            obj.selectable = true;
            obj.evented = true;
        });
        fabricCanvas.defaultCursor = 'default';
        fabricCanvas.requestRenderAll();
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
        setPenColor('green');
    };

    // Crisp vector tick — drawn as a stroked path so it looks like a real mark
    // (and scales/resizes cleanly) instead of a flat text glyph.
    const addTick = async (): Promise<void> => {
        if (!fabricCanvas) return;
        const tick = new Path('M 4 18 L 14 30 L 34 4', {
            left: 100,
            top: 100,
            stroke: 'green',
            strokeWidth: 5,
            fill: '',
            strokeLineCap: 'round',
            strokeLineJoin: 'round',
            selectable: true,
        });
        fabricCanvas.add(tick);
        fabricCanvas.requestRenderAll();
    };

    // Crisp vector cross (two stroked strokes in one path).
    const addCross = async (): Promise<void> => {
        if (!fabricCanvas) return;
        const cross = new Path('M 4 4 L 30 30 M 30 4 L 4 30', {
            left: 100,
            top: 100,
            stroke: 'red',
            strokeWidth: 5,
            fill: '',
            strokeLineCap: 'round',
            strokeLineJoin: 'round',
            selectable: true,
        });
        fabricCanvas.add(cross);
        fabricCanvas.requestRenderAll();
    };

    const addNumber = async (num: string): Promise<void> => {
        if (!fabricCanvas) return;
        const text = new IText(num, {
            left: 100,
            top: window.scrollY ?? 100,
            fontSize: 50,
            fill: 'blue',
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
            fill: 'transparent',
            stroke: 'black',
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
            fill: 'transparent',
            stroke: 'red',
            strokeWidth: 2,
            selectable: true,
            editable: false,
        });
        fabricCanvas?.add(circle);
        fabricCanvas?.renderAll();
    };

    function deleteSelectedShape() {
        // getActiveObjects() returns every selected object, so multi-select
        // (an ActiveSelection) is handled too — removing the wrapper alone leaves
        // the underlying objects on the canvas.
        const activeObjects = fabricCanvas?.getActiveObjects();
        if (fabricCanvas && activeObjects && activeObjects.length > 0) {
            activeObjects.forEach((obj) => fabricCanvas.remove(obj));
            fabricCanvas.discardActiveObject();
            fabricCanvas.requestRenderAll();
        } else {
            toast.error('Please select an item to delete');
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
        enableSelection,
        addTick,
        addCross,
        clearCanvas,
        disableDrawingMode,
        addNumber,
        addRectangle,
        addCircle,
        deleteSelectedShape,
    };
};

export default useFabric;
