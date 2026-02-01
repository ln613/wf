# Media tasks

## ffmpeg cut

### Input

- file name *
- duration (not required if end is provided)
- start = 0
- end = duration
- isCopy = false

### Action

- run the command "ffmpeg -ss {start} -to {end} -i {input file name} {'-c copy' if isCopy = true} {input file name (without the extension)}_edit.{input file extension}"

### Output

- wait for the command to finish and then return success info

## ffprobe duration

### Input

- file name *

### Action

- run the command "ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 {input file name}"

### Output

- wait for the command to finish and then return the duration
