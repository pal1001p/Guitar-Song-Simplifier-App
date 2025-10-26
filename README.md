# Guitar-Song-Simplifier-App
A WIP repo for the full-stack app of a personal project for simplifying guitar songs.

## Prerequisites
- Docker Desktop
- Git

## To run the app:
```bash
git clone <this-repo-url>
cd guitar-song-simplifier
docker compose up 
```
## API endpoints:
- Frontend: http://localhost:3000/
- Backend: http://localhost:8000/

## Example commands to try:
To get beat times:
```bash
curl -X POST "http://localhost:8000/analyze-audio/" \
>   -H "Content-Type: multipart/form-data" \
>   -F "file=@\"/your/file/path\""
```
