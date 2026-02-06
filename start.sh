cd src/
tmux new-session -d -s website
tmux send-keys -t website "python3.13 main.py" c-m
