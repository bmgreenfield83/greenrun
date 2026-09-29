import {
  Checkbox,
  FormControl,
  InputLabel,
  ListItemText,
  MenuItem,
  OutlinedInput,
  Select,
} from "@mui/material";
import type { SelectChangeEvent } from "@mui/material/Select";

import { categoryLabel } from "./format";

/** Multi-select filter over run categories; an empty list means none selected. */
export function CategoryFilter({
  categories,
  selected,
  onChange,
}: {
  categories: string[];
  selected: string[];
  onChange: (next: string[]) => void;
}) {
  return (
    <FormControl size="small" sx={{ minWidth: 220, maxWidth: "100%" }}>
      <InputLabel id="response-category-label">Run categories</InputLabel>
      <Select<string[]>
        labelId="response-category-label"
        multiple
        value={selected}
        onChange={(event: SelectChangeEvent<string[]>) => {
          const value = event.target.value;
          onChange(typeof value === "string" ? value.split(",") : value);
        }}
        input={<OutlinedInput label="Run categories" />}
        renderValue={(values) => {
          if (values.length === categories.length) return "All categories";
          if (values.length === 0) return "No categories";
          return values.map(categoryLabel).join(", ");
        }}
      >
        {categories.map((category) => (
          <MenuItem key={category} value={category}>
            <Checkbox
              checked={selected.includes(category)}
              inputProps={{ "aria-label": categoryLabel(category) }}
            />
            <ListItemText primary={categoryLabel(category)} />
          </MenuItem>
        ))}
      </Select>
    </FormControl>
  );
}
