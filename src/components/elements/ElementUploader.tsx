import {
  useEffect,
  useRef,
  useState,
  type DragEvent,
  type ChangeEvent,
} from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Upload, X, ImagePlus } from "lucide-react";
import {
  Modal,
  Button,
  HudInput,
  HudTextarea,
  Select,
} from "@/components/hud";
import { ElementWarningBanner } from "./ElementWarningBanner";
import {
  ELEMENT_TYPES,
  ELEMENT_TYPE_META,
  type ElementType,
} from "@/lib/elementTypes";
import {
  elementSchema,
  slugifyTag,
  type ElementFormData,
} from "@/lib/validators";
import { useElements } from "@/stores/elementsStore";
import { cn } from "@/lib/cn";

interface Props {
  open: boolean;
  onClose: () => void;
}

interface PendingImageItem {
  id: string;
  data_url: string;
  preview_url: string;
  original_name: string;
  size: number;
}

const MAX_IMAGES = 20;
const MAX_SIZE = 30 * 1024 * 1024;
const ALLOWED_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp"];

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export function ElementUploader({ open, onClose }: Props) {
  const create = useElements((s) => s.create);
  const items = useElements((s) => s.items);
  const [images, setImages] = useState<PendingImageItem[]>([]);
  const [dragActive, setDragActive] = useState(false);
  const dragCounter = useRef(0);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [autoTag, setAutoTag] = useState(true);

  const { register, control, handleSubmit, watch, setValue, formState, reset } =
    useForm<ElementFormData>({
      resolver: zodResolver(elementSchema),
      defaultValues: {
        tag: "",
        display_name: "",
        type: "character",
        description: "",
      },
      mode: "onChange",
    });

  const displayName = watch("display_name");
  const tagValue = watch("tag");

  useEffect(() => {
    if (autoTag && displayName) {
      setValue("tag", slugifyTag(displayName), { shouldValidate: true });
    }
  }, [displayName, autoTag, setValue]);

  useEffect(() => {
    if (!open) {
      images.forEach((img) => URL.revokeObjectURL(img.preview_url));
      setImages([]);
      reset();
      setAutoTag(true);
      setSubmitError(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const tagConflict = !!tagValue && items.some((e) => e.tag === tagValue);

  async function handleFiles(files: FileList | File[]) {
    const fileArr = Array.from(files);
    const valid = fileArr.filter(
      (f) => ALLOWED_TYPES.includes(f.type) && f.size <= MAX_SIZE,
    );
    const slotsLeft = MAX_IMAGES - images.length;
    const toAdd = valid.slice(0, slotsLeft);

    const newItems: PendingImageItem[] = await Promise.all(
      toAdd.map(async (file) => ({
        id: crypto.randomUUID(),
        data_url: await readAsDataUrl(file),
        preview_url: URL.createObjectURL(file),
        original_name: file.name,
        size: file.size,
      })),
    );

    if (!displayName && newItems[0]) {
      const baseName = newItems[0].original_name
        .replace(/\.[^.]+$/, "")
        .replace(/[_-]+/g, " ")
        .trim();
      const titleCased =
        baseName.charAt(0).toUpperCase() + baseName.slice(1);
      setValue("display_name", titleCased, { shouldValidate: true });
    }

    setImages((prev) => [...prev, ...newItems]);
  }

  function removeImage(id: string) {
    setImages((prev) => {
      const removed = prev.find((i) => i.id === id);
      if (removed) URL.revokeObjectURL(removed.preview_url);
      return prev.filter((i) => i.id !== id);
    });
  }

  function onDragEnter(e: DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current++;
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setDragActive(true);
    }
  }

  function onDragLeave(e: DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current--;
    if (dragCounter.current === 0) setDragActive(false);
  }

  function onDragOver(e: DragEvent) {
    e.preventDefault();
    e.stopPropagation();
  }

  function onDrop(e: DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    dragCounter.current = 0;
    if (e.dataTransfer.files.length) {
      void handleFiles(e.dataTransfer.files);
    }
  }

  function onFileInput(e: ChangeEvent<HTMLInputElement>) {
    if (e.target.files) {
      void handleFiles(e.target.files);
    }
    e.target.value = "";
  }

  async function onSubmit(data: ElementFormData) {
    if (tagConflict || images.length === 0) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      await create(
        {
          tag: data.tag,
          display_name: data.display_name,
          type: data.type as ElementType,
          description: data.description || null,
        },
        images.map((i) => ({
          data_url: i.data_url,
          original_name: i.original_name,
        })),
      );
      onClose();
    } catch (err) {
      setSubmitError(String(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="New Element"
      subtitle="// Register Reference"
      size="lg"
    >
      <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-6">
        <ElementWarningBanner />

        {/* Image upload */}
        <div className="space-y-2">
          <div className="flex items-baseline justify-between">
            <span className="hud-label text-fg-muted">References</span>
            <span className="font-mono text-[0.65rem] text-fg-dim">
              {images.length}/{MAX_IMAGES} · max 10MB each · jpg/png/webp
            </span>
          </div>

          <div
            onDragEnter={onDragEnter}
            onDragLeave={onDragLeave}
            onDragOver={onDragOver}
            onDrop={onDrop}
            className={cn(
              "relative grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-7 gap-2 p-3 min-h-[180px]",
              "border-2 border-dashed transition-colors",
              dragActive
                ? "border-hud-cyan bg-hud-cyan/5"
                : "border-border-hud",
            )}
          >
            {images.map((img) => (
              <div
                key={img.id}
                className="relative aspect-square border border-border-hud bg-bg-elevated overflow-hidden group"
              >
                <img
                  src={img.preview_url}
                  alt=""
                  className="absolute inset-0 w-full h-full object-cover"
                />
                <button
                  type="button"
                  onClick={() => removeImage(img.id)}
                  className="absolute top-1 right-1 w-5 h-5 bg-bg-base/80 border border-hud-red text-hud-red flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                  aria-label="Remove"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}

            {images.length < MAX_IMAGES && (
              <label className="relative aspect-square border border-border-hud bg-bg-elevated/40 hover:bg-hud-cyan/5 hover:border-hud-cyan/60 transition-colors flex flex-col items-center justify-center gap-1 cursor-pointer">
                <ImagePlus
                  className="w-5 h-5 text-fg-muted"
                  strokeWidth={1.2}
                />
                <span className="font-mono text-[0.55rem] uppercase text-fg-dim">
                  Add
                </span>
                <input
                  type="file"
                  multiple
                  accept="image/jpeg,image/png,image/webp"
                  onChange={onFileInput}
                  className="hidden"
                />
              </label>
            )}

            {images.length === 0 && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 pointer-events-none">
                <Upload
                  className="w-8 h-8 text-fg-dim"
                  strokeWidth={1.2}
                />
                <div className="text-center">
                  <div className="font-mono text-xs uppercase tracking-[0.1em] text-fg">
                    Drop images here
                  </div>
                  <div className="font-mono text-[0.65rem] text-fg-dim mt-1">
                    or click "Add" to browse
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Form fields */}
        <div className="grid grid-cols-2 gap-4">
          <HudInput
            label="Display Name"
            placeholder="Jane the Pilot"
            error={formState.errors.display_name?.message}
            {...register("display_name")}
          />

          <HudInput
            label="Tag"
            mono
            placeholder="jane"
            error={
              formState.errors.tag?.message ||
              (tagConflict ? "Tag already in use" : undefined)
            }
            value={tagValue}
            onChange={(e) => {
              setAutoTag(false);
              setValue("tag", e.target.value, { shouldValidate: true });
            }}
            hint="Lowercase letters, numbers, underscores. Used as @reference in prompts."
          />
        </div>

        <Controller
          name="type"
          control={control}
          render={({ field }) => (
            <Select
              label="Type"
              value={field.value}
              onChange={field.onChange}
              options={ELEMENT_TYPES.map((t) => ({
                value: t,
                label: ELEMENT_TYPE_META[t].label,
                color: ELEMENT_TYPE_META[t].color,
              }))}
            />
          )}
        />

        <HudTextarea
          label="Description"
          placeholder="Optional context for this reference. Helps when reviewing later."
          error={formState.errors.description?.message}
          {...register("description")}
        />

        {submitError && (
          <div className="border border-hud-red/60 bg-hud-red/10 px-3 py-2 font-mono text-xs text-hud-red">
            {submitError}
          </div>
        )}

        <div className="flex items-center justify-end gap-3 pt-2 border-t border-border-hud">
          <Button
            type="button"
            variant="ghost"
            onClick={onClose}
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            loading={submitting}
            disabled={
              !formState.isValid || tagConflict || images.length === 0
            }
            iconLeft={<Upload className="w-4 h-4" />}
          >
            Register Element
          </Button>
        </div>
      </form>
    </Modal>
  );
}
