@echo off
REM Activate virtual environment if it exists
if exist "venv\Scripts\activate.bat" (
    call venv\Scripts\activate.bat
)

REM Try to run on port 80 first, if that fails, use port 8080
python -c "from app import app; app.run(host='0.0.0.0', port=80)" || python -c "from app import app; app.run(host='0.0.0.0', port=8080)"

REM Keep the window open if there's an error
if errorlevel 1 pause
