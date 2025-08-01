"use client";

import { useState } from "react";
import { Button } from "../../ui/button";
import {
  MoreVertical,
  Scissors,
  Trash2,
  SplitSquareHorizontal,
  Music,
  ChevronRight,
  ChevronLeft,
  Type,
  Copy,
  RefreshCw,
  EyeOff,
  Eye,
  Volume2,
  VolumeX,
} from "lucide-react";
import { useMediaStore } from "@/stores/media-store";
import { useTimelineStore } from "@/stores/timeline-store";
import { usePlaybackStore } from "@/stores/playback-store";
import AudioWaveform from "../audio-waveform";
import { toast } from "sonner";
import { TimelineElementProps, TrackType } from "@/types/timeline";
import { useTimelineElementResize } from "@/hooks/use-timeline-element-resize";
import {
  getTrackElementClasses,
  TIMELINE_CONSTANTS,
  getTrackHeight,
} from "@/constants/timeline-constants";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from "../../ui/dropdown-menu";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "../../ui/context-menu";

export function TimelineElement({
  element,
  track,
  zoomLevel,
  isSelected,
  onElementMouseDown,
  onElementClick,
}: TimelineElementProps) {
  const { mediaItems } = useMediaStore();
  const {
    updateElementTrim,
    updateElementDuration,
    removeElementFromTrack,
    removeElementFromTrackWithRipple,
    dragState,
    splitElement,
    splitAndKeepLeft,
    splitAndKeepRight,
    separateAudio,
    extractAudioFromMedia,
    addElementToTrack,
    replaceElementMedia,
    rippleEditingEnabled,
    toggleElementHidden,
    toolMode,
  } = useTimelineStore();
  const { currentTime } = usePlaybackStore();

  const [elementMenuOpen, setElementMenuOpen] = useState(false);

  const mediaItem =
    element.type === "media"
      ? mediaItems.find((item) => item.id === element.mediaId)
      : null;
  const isAudio = mediaItem?.type === "audio";

  const {
    resizing,
    isResizing,
    handleResizeStart,
    handleResizeMove,
    handleResizeEnd,
  } = useTimelineElementResize({
    element,
    track,
    zoomLevel,
    onUpdateTrim: updateElementTrim,
    onUpdateDuration: updateElementDuration,
  });

  const effectiveDuration =
    element.duration - element.trimStart - element.trimEnd;
  const elementWidth = Math.max(
    TIMELINE_CONSTANTS.ELEMENT_MIN_WIDTH,
    effectiveDuration * TIMELINE_CONSTANTS.PIXELS_PER_SECOND * zoomLevel
  );

  // Use real-time position during drag, otherwise use stored position
  const isBeingDragged = dragState.elementId === element.id;
  const elementStartTime =
    isBeingDragged && dragState.isDragging
      ? dragState.currentTime
      : element.startTime;

  // Element should always be positioned at startTime - trimStart only affects content, not position
  const elementLeft = elementStartTime * 50 * zoomLevel;

  const handleElementSplitContext = (e: React.MouseEvent) => {
    e.stopPropagation();
    const effectiveStart = element.startTime;
    const effectiveEnd =
      element.startTime +
      (element.duration - element.trimStart - element.trimEnd);

    if (currentTime > effectiveStart && currentTime < effectiveEnd) {
      const secondElementId = splitElement(track.id, element.id, currentTime);
      if (!secondElementId) {
        toast.error("Failed to split element");
      }
    } else {
      toast.error("Playhead must be within element to split");
    }
  };

  const handleElementDuplicateContext = (e: React.MouseEvent) => {
    e.stopPropagation();
    const { id, ...elementWithoutId } = element;
    addElementToTrack(track.id, {
      ...elementWithoutId,
      name: element.name + " (copy)",
      startTime:
        element.startTime +
        (element.duration - element.trimStart - element.trimEnd) +
        0.1,
    });
  };

  const handleElementDeleteContext = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (rippleEditingEnabled) {
      removeElementFromTrackWithRipple(track.id, element.id);
    } else {
      removeElementFromTrack(track.id, element.id);
    }
  };

  const handleToggleElementHidden = (e: React.MouseEvent) => {
    e.stopPropagation();
    toggleElementHidden(track.id, element.id);
  };

  const handleExtractAudio = async (e: React.MouseEvent) => {
    e.stopPropagation();
    await extractAudioFromMedia(track.id, element.id);
  };

  const handleReplaceClip = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (element.type !== "media") {
      toast.error("Replace is only available for media clips");
      return;
    }

    // Create a file input to select replacement media
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "video/*,audio/*,image/*";
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      try {
        const result = await replaceElementMedia(track.id, element.id, file);
        if (result.success) {
          toast.success("Clip replaced successfully");
        } else {
          toast.error(result.error || "Failed to replace clip");
        }
      } catch (error) {
        console.error("Unexpected error replacing clip:", error);
        toast.error(
          `Unexpected error: ${error instanceof Error ? error.message : "Unknown error"}`
        );
      }
    };
    input.click();
  };

  const renderElementContent = () => {
    if (element.type === "text") {
      return (
        <div className="w-full h-full flex items-center justify-start pl-2">
          <span className="text-xs text-foreground/80 truncate">
            {element.content}
          </span>
        </div>
      );
    }

    // Render media element ->
    const mediaItem = mediaItems.find((item) => item.id === element.mediaId);
    if (!mediaItem) {
      return (
        <span className="text-xs text-foreground/80 truncate">
          {element.name}
        </span>
      );
    }

    const TILE_ASPECT_RATIO = 16 / 9;

    if (mediaItem.type === "image") {
      // Calculate tile size based on 16:9 aspect ratio
      const trackHeight = getTrackHeight(track.type);
      const tileHeight = trackHeight - 8; // Account for padding
      const tileWidth = tileHeight * TILE_ASPECT_RATIO;

      return (
        <div className="w-full h-full flex items-center justify-center">
          <div className="bg-[#004D52] py-3 w-full h-full relative">
            {/* Background with tiled images */}
            <div
              className="absolute top-3 bottom-3 left-0 right-0"
              style={{
                backgroundImage: mediaItem.url
                  ? `url(${mediaItem.url})`
                  : "none",
                backgroundRepeat: "repeat-x",
                backgroundSize: `${tileWidth}px ${tileHeight}px`,
                backgroundPosition: "left center",
                pointerEvents: "none",
              }}
              aria-label={`Tiled background of ${mediaItem.name}`}
            />
            {/* Overlay with vertical borders */}
            <div
              className="absolute top-3 bottom-3 left-0 right-0 pointer-events-none"
              style={{
                backgroundImage: `repeating-linear-gradient(
                  to right,
                  transparent 0px,
                  transparent ${tileWidth - 1}px,
                  rgba(255, 255, 255, 0.6) ${tileWidth - 1}px,
                  rgba(255, 255, 255, 0.6) ${tileWidth}px
                )`,
                backgroundPosition: "left center",
              }}
            />
          </div>
        </div>
      );
    }

    const VIDEO_TILE_PADDING = 16;
    const OVERLAY_SPACE_MULTIPLIER = 1.5;

    if (mediaItem.type === "video" && mediaItem.thumbnailUrl) {
      const trackHeight = getTrackHeight(track.type);
      const tileHeight = trackHeight - 8; // Match image padding
      const tileWidth = tileHeight * TILE_ASPECT_RATIO;

      return (
        <div className="w-full h-full flex items-center justify-center">
          <div className="bg-[#004D52] py-3 w-full h-full relative">
            {/* Background with tiled thumbnails */}
            <div
              className="absolute top-3 bottom-3 left-0 right-0"
              style={{
                backgroundImage: mediaItem.thumbnailUrl
                  ? `url(${mediaItem.thumbnailUrl})`
                  : "none",
                backgroundRepeat: "repeat-x",
                backgroundSize: `${tileWidth}px ${tileHeight}px`,
                backgroundPosition: "left center",
                pointerEvents: "none",
              }}
              aria-label={`Tiled thumbnail of ${mediaItem.name}`}
            />
            {/* Overlay with vertical borders */}
            <div
              className="absolute top-3 bottom-3 left-0 right-0 pointer-events-none"
              style={{
                backgroundImage: `repeating-linear-gradient(
                  to right,
                  transparent 0px,
                  transparent ${tileWidth - 1}px,
                  rgba(255, 255, 255, 0.6) ${tileWidth - 1}px,
                  rgba(255, 255, 255, 0.6) ${tileWidth}px
                )`,
                backgroundPosition: "left center",
              }}
            />
          </div>
        </div>
      );
    }

    // Render audio element ->
    if (mediaItem.type === "audio") {
      return (
        <div className="w-full h-full flex items-center gap-2">
          <div className="flex-1 min-w-0">
            <AudioWaveform
              audioUrl={mediaItem.url || ""}
              height={24}
              className="w-full"
            />
          </div>
        </div>
      );
    }

    return (
      <span className="text-xs text-foreground/80 truncate">
        {element.name}
      </span>
    );
  };

  const handleElementMouseDown = (e: React.MouseEvent) => {
    if (onElementMouseDown) {
      onElementMouseDown(e, element);
    }
  };

  const handleElementClick = (e: React.MouseEvent) => {
    // Handle split mode
    if (toolMode === "split") {
      e.preventDefault();
      e.stopPropagation();

      // Calculate click position relative to element
      const rect = e.currentTarget.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const clickTime = element.startTime + (clickX / (TIMELINE_CONSTANTS.PIXELS_PER_SECOND * zoomLevel));

      // Ensure click time is within element bounds
      const effectiveStart = element.startTime;
      const effectiveEnd = element.startTime + (element.duration - element.trimStart - element.trimEnd);

      if (clickTime >= effectiveStart && clickTime <= effectiveEnd) {
        const secondElementId = splitElement(track.id, element.id, clickTime);
        if (!secondElementId) {
          toast.error("Failed to split element");
        }
      } else {
        // If click is outside element bounds, just move playhead to that position
        const { seek } = usePlaybackStore.getState();
        seek(clickTime);
      }
      return;
    }

    // Normal click handling
    if (onElementClick) {
      onElementClick(e, element);
    }
  };

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div
          className={`absolute top-0 h-full select-none timeline-element ${
            isBeingDragged ? "z-50" : "z-10"
          }`}
          style={{
            left: `${elementLeft}px`,
            width: `${elementWidth}px`,
          }}
          data-element-id={element.id}
          data-track-id={track.id}
          onMouseMove={resizing ? handleResizeMove : undefined}
          onMouseUp={resizing ? handleResizeEnd : undefined}
          onMouseLeave={resizing ? handleResizeEnd : undefined}
        >
          <div
            className={`relative h-full rounded-[0.15rem] overflow-hidden ${getTrackElementClasses(
              track.type
            )} ${isSelected ? "border-b-[0.5px] border-t-[0.5px] border-foreground" : ""} ${
              isBeingDragged ? "z-50" : "z-10"
            } ${element.hidden ? "opacity-50" : ""} ${
              toolMode === "split" ? "cursor-crosshair" : "cursor-pointer"
            }`}
            onClick={handleElementClick}
            onMouseDown={handleElementMouseDown}
            onContextMenu={(e) =>
              onElementMouseDown && onElementMouseDown(e, element)
            }
          >
            <div className="absolute inset-0 flex items-center h-full">
              {renderElementContent()}
            </div>

            {element.hidden && (
              <div className="absolute inset-0 bg-black opacity-65 flex items-center justify-center pointer-events-none">
                {isAudio ? (
                  <VolumeX className="size-6 text-white" />
                ) : (
                  <EyeOff className="size-6 text-white" />
                )}
              </div>
            )}

            {/* Split mode indicator */}
            {toolMode === "split" && (
              <div className="absolute inset-0 bg-primary/10 border border-primary/30 pointer-events-none" />
            )}

            {isSelected && (
              <>
                <div
                  className="absolute left-0 top-0 bottom-0 w-1 cursor-w-resize bg-foreground z-50"
                  onMouseDown={(e) => handleResizeStart(e, element.id, "left")}
                />
                <div
                  className="absolute right-0 top-0 bottom-0 w-1 cursor-e-resize bg-foreground z-50"
                  onMouseDown={(e) => handleResizeStart(e, element.id, "right")}
                />
              </>
            )}
          </div>
        </div>
      </ContextMenuTrigger>
      <ContextMenuContent className="z-200">
        <ContextMenuItem onClick={handleElementSplitContext}>
          <Scissors className="size-4 mr-2" />
          Split at playhead
        </ContextMenuItem>
        <ContextMenuItem onClick={handleToggleElementHidden}>
          {isAudio ? (
            element.hidden ? (
              <Volume2 className="size-4 mr-2" />
            ) : (
              <VolumeX className="size-4 mr-2" />
            )
          ) : element.hidden ? (
            <Eye className="size-4 mr-2" />
          ) : (
            <EyeOff className="size-4 mr-2" />
          )}
          <span>
            {isAudio
              ? element.hidden
                ? "Unmute"
                : "Mute"
              : element.hidden
              ? "Show"
              : "Hide"}{" "}
            {element.type === "text" ? "text" : "clip"}
          </span>
        </ContextMenuItem>
        <ContextMenuItem onClick={handleElementDuplicateContext}>
          <Copy className="size-4 mr-2" />
          Duplicate {element.type === "text" ? "text" : "clip"}
        </ContextMenuItem>
        <ContextMenuSeparator />
        {element.type === "media" && (
          <>
            <ContextMenuItem onClick={handleReplaceClip}>
              <RefreshCw className="size-4 mr-2" />
              Replace clip
            </ContextMenuItem>
            {mediaItem && mediaItem.type === "video" && (
              <ContextMenuItem onClick={handleExtractAudio}>
                <Music className="size-4 mr-2" />
                Extract audio
              </ContextMenuItem>
            )}
          </>
        )}
        <ContextMenuSeparator />
        <ContextMenuItem
          onClick={handleElementDeleteContext}
          className="text-destructive focus:text-destructive"
        >
          <Trash2 className="size-4 mr-2" />
          Delete {element.type === "text" ? "text" : "clip"}
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}
