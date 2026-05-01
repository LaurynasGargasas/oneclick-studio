import { useEffect, useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Save, FolderPlus } from "lucide-react";
import { Modal, Button, HudInput, HudTextarea } from "@/components/hud";
import { ColorPicker } from "@/components/hud/ColorPicker";
import { PROJECT_ACCENT_PALETTE } from "@/lib/projectColors";
import { useProjects } from "@/stores/projectsStore";

const projectSchema = z.object({
  name: z.string().min(1, "Required").max(80, "Up to 80 characters"),
  description: z
    .string()
    .max(500, "Up to 500 characters")
    .optional()
    .or(z.literal("")),
  color_accent: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Pick a color"),
});

type FormData = z.infer<typeof projectSchema>;

interface InitialProject {
  id: string;
  name: string;
  description: string | null;
  color_accent: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  initial?: InitialProject;
}

export function ProjectFormModal({ open, onClose, initial }: Props) {
  const create = useProjects((s) => s.create);
  const update = useProjects((s) => s.update);
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const editing = !!initial;

  const { register, control, handleSubmit, formState, reset } =
    useForm<FormData>({
      resolver: zodResolver(projectSchema),
      defaultValues: {
        name: initial?.name || "",
        description: initial?.description || "",
        color_accent:
          initial?.color_accent || PROJECT_ACCENT_PALETTE[0].value,
      },
      mode: "onChange",
    });

  useEffect(() => {
    if (open) {
      reset({
        name: initial?.name || "",
        description: initial?.description || "",
        color_accent:
          initial?.color_accent || PROJECT_ACCENT_PALETTE[0].value,
      });
      setErr(null);
    }
  }, [open, initial, reset]);

  async function onSubmit(data: FormData) {
    setSubmitting(true);
    setErr(null);
    try {
      if (editing && initial) {
        await update(initial.id, {
          name: data.name,
          description: data.description || null,
          color_accent: data.color_accent,
        });
      } else {
        await create({
          name: data.name,
          description: data.description || null,
          color_accent: data.color_accent,
        });
      }
      onClose();
    } catch (e) {
      setErr(String(e));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editing ? "Edit Project" : "New Project"}
      subtitle={editing ? "// Update Workspace" : "// Create Workspace"}
      size="md"
    >
      <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-5">
        <HudInput
          label="Name"
          placeholder="Sci-Fi Short Film"
          autoFocus
          error={formState.errors.name?.message}
          {...register("name")}
        />

        <HudTextarea
          label="Description"
          placeholder="Optional. What is this project about?"
          error={formState.errors.description?.message}
          {...register("description")}
        />

        <Controller
          control={control}
          name="color_accent"
          render={({ field }) => (
            <ColorPicker
              label="Accent Color"
              value={field.value}
              onChange={field.onChange}
              options={PROJECT_ACCENT_PALETTE}
            />
          )}
        />

        {err && (
          <div className="border border-hud-red/60 bg-hud-red/10 px-3 py-2 font-mono text-xs text-hud-red">
            {err}
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
            disabled={!formState.isValid}
            iconLeft={
              editing ? (
                <Save className="w-4 h-4" />
              ) : (
                <FolderPlus className="w-4 h-4" />
              )
            }
          >
            {editing ? "Save Changes" : "Create Project"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
