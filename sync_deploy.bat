@echo off
chcp 65001 >nul
echo Đang đồng bộ dự án Modular 3D Office (HTML + CSS + JS) lên GitHub Pages...
copy /Y "d:\LINH_TINH\m_h_nh_3d_v_n_ph_ng_it_t_ng_t_c.html" "d:\LINH_TINH\index.html" >nul
copy /Y "d:\LINH_TINH\index.html" "d:\LINH_TINH\deploy_van_phong_3d\index.html" >nul
xcopy /E /I /Y "d:\LINH_TINH\css" "d:\LINH_TINH\deploy_van_phong_3d\css" >nul
xcopy /E /I /Y "d:\LINH_TINH\js" "d:\LINH_TINH\deploy_van_phong_3d\js" >nul
cd /d "d:\LINH_TINH\deploy_van_phong_3d"
git add -A
git commit -m "Sync modular 3D IT Office (HTML/CSS/JS + WebRTC Meeting Call)"
git push origin main
echo Hoàn tất! Trang web sẽ tự cập nhật sau ~30 giây tại: https://dangcntt.github.io/van-phong-it-3d/
pause
