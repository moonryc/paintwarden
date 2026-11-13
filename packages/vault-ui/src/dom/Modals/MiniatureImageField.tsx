import { imageUrl } from "../utils/image-cache";
import { Alert, Button } from "@mui/material";
import Box from "@mui/material/Box";
import { useEffect, useRef, useState } from "react";

import { ImageMinus, ImagePlus, RotateCw } from "../icons";
import { useVaultStore } from "../store/hooks";
import { buttonResetSx } from "../utils/element-resets";
import { droppedImageUrl, imageNameFromUrl, rotateImage } from "../utils/image";

// The project photo: a drop zone for an image file or image link, with a preview behind it and
// buttons to rotate, remove, or go back to the saved photo.
export function MiniatureImageField({
  image,
  onImageChange,
  removeImage,
  onRemoveImageChange,
  savedImageUrl,
  templateImageUrl,
}: {
  image: File | null;
  onImageChange(image: File | null): void;
  // The saved or template photo is being removed.
  removeImage: boolean;
  onRemoveImageChange(remove: boolean): void;
  // The miniature's saved photo, when editing.
  savedImageUrl?: string | null;
  // The photo of the mini-template being added from.
  templateImageUrl: string;
}) {
  const authHeaders = useVaultStore((s) => s.authHeaders);
  const [importing, setImporting] = useState(false),
    [rotating, setRotating] = useState(false),
    [imageError, setImageError] = useState(""),
    [dragging, setDragging] = useState(false),
    [previewUrl, setPreviewUrl] = useState(savedImageUrl ?? "");
  const fileRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (removeImage) {
      setPreviewUrl("");
      return;
    }
    if (!image) {
      setPreviewUrl(savedImageUrl ?? templateImageUrl);
      return;
    }
    const url = URL.createObjectURL(image);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [image, savedImageUrl, removeImage, templateImageUrl]);
  const chooseImage = (file?: File) => {
    if (file?.type.startsWith("image/")) {
      onImageChange(file);
      onRemoveImageChange(false);
      setImageError("");
    } else if (file) setImageError("Choose an image file");
  };
  const importImageUrl = async (url: string) => {
    setImporting(true);
    setImageError("");
    try {
      const response = await fetch("/api/image-import", {
        method: "POST",
        headers: { "content-type": "application/json", ...authHeaders() },
        body: JSON.stringify({ url }),
      });
      if (!response.ok) {
        const result = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(result.error || "Could not import that image");
      }
      const blob = await response.blob();
      chooseImage(new File([blob], imageNameFromUrl(url), { type: blob.type || "image/jpeg" }));
    } catch (error) {
      setImageError(error instanceof Error ? error.message : "Could not import that image");
    } finally {
      setImporting(false);
    }
  };
  return (
    <>
      <Box
        component="div"
        sx={[
          {
            boxSizing: "border-box",
            position: "relative",
            overflow: "hidden",
            borderRadius: "1rem",
            borderStyle: "dashed",
            borderWidth: "2px",
            transition:
              "border-color 150ms cubic-bezier(0.4, 0, 0.2, 1), background-color 150ms cubic-bezier(0.4, 0, 0.2, 1)",
          },
          dragging
            ? {
                borderColor: "var(--brand)",
                bgcolor: "var(--brand-soft)",
              }
            : {
                borderColor: "var(--line-strong)",
                bgcolor: "color-mix(in oklab, var(--sunken) 60%, transparent)",
                "&:hover": {
                  "@media (hover: hover)": {
                    borderColor: "color-mix(in oklab, var(--brand) 70%, transparent)",
                  },
                },
              },
        ]}
        onDragEnter={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragOver={(e) => {
          e.preventDefault();
          e.dataTransfer.dropEffect = "copy";
        }}
        onDragLeave={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDragging(false);
        }}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          const file = e.dataTransfer.files[0];
          if (file) chooseImage(file);
          else {
            const url = droppedImageUrl(e.dataTransfer);
            if (url) void importImageUrl(url);
            else setImageError("Drop an image file or a direct image link");
          }
        }}
      >
        {previewUrl && (
          <Box
            component="img"
            src={imageUrl(previewUrl)}
            alt="Project preview"
            draggable={false}
            sx={{
              pointerEvents: "none",
              position: "absolute",
              inset: 0,
              height: "100%",
              width: "100%",
              objectFit: "cover",
              opacity: 0.35,
              WebkitUserSelect: "none",
              userSelect: "none",
            }}
          />
        )}
        <Box
          component="button"
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={importing || rotating}
          sx={{
            ...buttonResetSx,
            boxSizing: "border-box",
            position: "relative",
            display: "flex",
            minHeight: "9rem",
            width: "100%",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 1,
            px: 2.5,
            py: 3,
            textAlign: "center",
            "&:disabled": {
              cursor: "wait",
            },
          }}
        >
          <Box
            component="span"
            sx={{
              display: "grid",
              height: "2.75rem",
              width: "2.75rem",
              placeItems: "center",
              borderRadius: "16px",
              bgcolor: "var(--surface-raised)",
              color: "var(--brand-text)",
              boxShadow: "var(--shadow-sm)",
            }}
          >
            <ImagePlus size={21} />
          </Box>
          <Box
            component="span"
            sx={{
              fontSize: "0.875rem",
              lineHeight: 10 / 7,
              fontWeight: 600,
            }}
          >
            {rotating
              ? "Rotating photo…"
              : importing
                ? "Importing photo…"
                : dragging
                  ? "Drop photo here"
                  : previewUrl
                    ? "Drop a replacement photo"
                    : "Drag and drop a project photo"}
          </Box>
          <Box
            component="span"
            sx={{
              fontSize: "0.75rem",
              lineHeight: 4 / 3,
              color: "var(--ink-faint)",
            }}
          >
            Drop an image file or image link, or click to choose
          </Box>
        </Box>
        {previewUrl && (
          <Button
            type="button"
            size="small"
            variant="overlay"
            startIcon={<RotateCw size={14} />}
            disabled={rotating || importing}
            onClick={async () => {
              setRotating(true);
              setImageError("");
              try {
                onImageChange(await rotateImage(image ?? previewUrl, authHeaders()));
              } catch (error) {
                setImageError(error instanceof Error ? error.message : "Could not rotate photo");
              } finally {
                setRotating(false);
              }
            }}
            sx={{
              boxSizing: "border-box",
              position: "absolute",
              bottom: "0.75rem",
              left: "0.75rem",
            }}
          >
            Rotate
          </Button>
        )}
        {image && savedImageUrl && (
          <Button
            type="button"
            size="small"
            variant="overlay"
            onClick={() => {
              onImageChange(null);
              onRemoveImageChange(false);
            }}
            sx={{
              boxSizing: "border-box",
              position: "absolute",
              right: "0.75rem",
              bottom: "0.75rem",
            }}
          >
            Use current photo
          </Button>
        )}
        {previewUrl && (!image || !savedImageUrl) && (
          <Button
            type="button"
            size="small"
            variant="overlay"
            startIcon={<ImageMinus size={14} />}
            onClick={() => {
              onImageChange(null);
              onRemoveImageChange(!!savedImageUrl || !!templateImageUrl);
            }}
            sx={{
              boxSizing: "border-box",
              position: "absolute",
              right: "0.75rem",
              bottom: "0.75rem",
              color: "var(--rust)",
            }}
          >
            Remove photo
          </Button>
        )}
        {removeImage && savedImageUrl && (
          <Button
            type="button"
            size="small"
            variant="overlay"
            onClick={() => onRemoveImageChange(false)}
            sx={{
              boxSizing: "border-box",
              position: "absolute",
              right: "0.75rem",
              bottom: "0.75rem",
            }}
          >
            Keep current photo
          </Button>
        )}
        <input
          ref={fileRef}
          hidden
          type="file"
          accept="image/*"
          onChange={(e) => {
            chooseImage(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
      </Box>
      {imageError && <Alert severity="error">{imageError}</Alert>}
    </>
  );
}
