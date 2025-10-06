import { useState, useRef, useCallback } from 'react';

export function usePanelResize() {
  const [leftPanelWidth, setLeftPanelWidth] = useState(33.33);
  const [middlePanelWidth, setMiddlePanelWidth] = useState(33.33);
  const [rightPanelWidth, setRightPanelWidth] = useState(33.34);
  const [isResizing, setIsResizing] = useState(false);

  const leftResizeRef = useRef<HTMLDivElement>(null);
  const rightResizeRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleMouseDown = useCallback((e: React.MouseEvent, resizeType: 'left' | 'right') => {
    e.preventDefault();
    setIsResizing(true);
    
    const startX = e.clientX;
    const startLeftWidth = leftPanelWidth;
    const startMiddleWidth = middlePanelWidth;
    const startRightWidth = rightPanelWidth;

    const handleMouseMove = (e: MouseEvent) => {
      const deltaX = e.clientX - startX;
      const containerWidth = containerRef.current?.offsetWidth || 0;
      const deltaPercent = (deltaX / containerWidth) * 100;

      if (resizeType === 'left') {
        const newLeftWidth = Math.max(20, Math.min(60, startLeftWidth + deltaPercent));
        const newMiddleWidth = Math.max(20, Math.min(60, startMiddleWidth - deltaPercent));
        const newRightWidth = 100 - newLeftWidth - newMiddleWidth;

        setLeftPanelWidth(newLeftWidth);
        setMiddlePanelWidth(newMiddleWidth);
        setRightPanelWidth(newRightWidth);
      } else {
        const newMiddleWidth = Math.max(20, Math.min(60, startMiddleWidth + deltaPercent));
        const newRightWidth = Math.max(20, Math.min(60, startRightWidth - deltaPercent));
        const newLeftWidth = 100 - newMiddleWidth - newRightWidth;

        setMiddlePanelWidth(newMiddleWidth);
        setRightPanelWidth(newRightWidth);
        setLeftPanelWidth(newLeftWidth);
      }
    };

    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      setIsResizing(false);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }, [leftPanelWidth, middlePanelWidth, rightPanelWidth]);

  return {
    leftPanelWidth,
    middlePanelWidth,
    rightPanelWidth,
    leftResizeRef,
    rightResizeRef,
    containerRef,
    handleMouseDown,
    isResizing
  };
}
