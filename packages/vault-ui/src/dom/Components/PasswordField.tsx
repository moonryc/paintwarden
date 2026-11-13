import VisibilityIcon from "@mui/icons-material/Visibility";
import VisibilityOffIcon from "@mui/icons-material/VisibilityOff";
import type { TextFieldProps } from "@mui/material";
import { IconButton, InputAdornment, TextField } from "@mui/material";
import { useState } from "react";

export function PasswordField(props: Omit<TextFieldProps, "type" | "slotProps">) {
  const [visible, setVisible] = useState(false);
  return (
    <TextField
      {...props}
      type={visible ? "text" : "password"}
      slotProps={{
        htmlInput: { autoCapitalize: "none", autoCorrect: "off", spellCheck: false },
        input: {
          endAdornment: (
            <InputAdornment position="end">
              <IconButton
                type="button"
                edge="end"
                aria-label={visible ? "Hide password" : "Show password"}
                aria-pressed={visible}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => setVisible((current) => !current)}
              >
                {visible ? <VisibilityOffIcon /> : <VisibilityIcon />}
              </IconButton>
            </InputAdornment>
          ),
        },
      }}
    />
  );
}
