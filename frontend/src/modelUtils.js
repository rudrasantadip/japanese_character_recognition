export const humanize = (value) =>
  value
    ? String(value).replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase())
    : null;

export const lower = (value) => (value ? String(value).replace(/_/g, " ") : "");

export const dims = (model) => ({
  w: model?.input?.width ?? model?.input?.shape?.[2] ?? 0,
  h: model?.input?.height ?? model?.input?.shape?.[1] ?? 0
});

export const pixelCount = (model) => {
  const { w, h } = dims(model);
  return w * h;
};

export const shortName = (model) => model.display_name || model.id;
