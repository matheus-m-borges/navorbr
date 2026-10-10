@echo off
cd /d d:\Documentos\GitHub\ativaconsult
del final_push.bat 2>nul
git add -A
git commit -m "chore: cleanup batch files"
git push
