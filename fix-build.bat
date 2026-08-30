@echo off
setlocal enabledelayedexpansion
cd /d "%~dp0"

echo ============================================
echo   Diagnostic erp-conciergerie
echo ============================================
echo Dossier courant : %cd%
echo.

if not exist "lib\prisma.ts" (
    echo [ERREUR] lib\prisma.ts est INTROUVABLE ici.
    echo.
    echo Cause la plus probable : l'extraction du zip a cree un dossier
    echo imbrique en double, par ex. :
    echo   Desktop\erp-conciergerie\erp-conciergerie\lib\prisma.ts
    echo au lieu de :
    echo   Desktop\erp-conciergerie\lib\prisma.ts
    echo.
    echo -^> Verifie dans l'explorateur de fichiers s'il y a un sous-dossier
    echo    "erp-conciergerie" a l'interieur de celui-ci, et relance ce
    echo    script depuis le bon dossier ^(celui qui contient package.json
    echo    ET lib\ directement^).
    echo.
    pause
    exit /b 1
)

echo [OK] lib\prisma.ts trouve.
if not exist "lib\cleaning.ts" (
    echo [ERREUR] lib\cleaning.ts est INTROUVABLE ici, alors que lib\prisma.ts existe.
    echo Un antivirus a peut-etre supprime/mis en quarantaine ce fichier.
    echo Re-extrais le zip original et reessaie.
    pause
    exit /b 1
)
echo [OK] lib\cleaning.ts trouve.
echo.

echo Nettoyage du cache de build (.next)...
if exist ".next" (
    rmdir /s /q ".next"
    echo [OK] .next supprime.
) else (
    echo [OK] Pas de .next existant.
)
echo.

echo Verification de node_modules...
if not exist "node_modules" (
    echo node_modules absent, installation...
    call npm install
) else (
    echo [OK] node_modules present.
)
echo.

echo ============================================
echo   Lancement de npm run build
echo ============================================
call npm run build

echo.
echo Termine. Si l'erreur "Module not found: Can't resolve '@/lib/...'"
echo persiste malgre tout ce qui precede, copie-colle la sortie complete
echo ci-dessus pour investigation.
pause
