#!/bin/bash
python -c "from app import app; app.run(host='0.0.0.0', port=80)" || python -c "from app import app; app.run(host='0.0.0.0', port=8080)" || read -p "Press enter to continue..."
