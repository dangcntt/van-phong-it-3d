@echo off
chcp 65001 >nul
echo Đang đồng bộ file m_h_nh_3d_v_n_ph_ng_it_t_ng_t_c.html lên GitHub Pages...
copy /Y "d:\LINH_TINH\m_h_nh_3d_v_n_ph_ng_it_t_ng_t_c.html" "d:\LINH_TINH\deploy_van_phong_3d\index.html" >nul
cd /d "d:\LINH_TINH\deploy_van_phong_3d"
git add -A
git commit -m "Update 3D IT Office"
git push origin main
echo Hoàn tất! Trang web sẽ tự cập nhật sau ~30 giây tại: https://dangcntt.github.io/van-phong-it-3d/
pause
