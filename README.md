# Dự án Nén File JSON

## Cấu trúc dự án

- `question1.js`: Kiểm tra chuỗi đối xứng
- `question2.js`: Giải thuật Two Sum
- `question3.js`: Nén file JSON bằng DEFLATE
- `question3-1.js`: Nén file JSON với Compression method (0 = stored) để đảm bảo tạo được file zib trước
- `test.json`: File JSON mẫu để test

## Vấn đề hiện tại với Question 3 (Nén ZIP)

1. **Tỷ lệ nén chưa tối ưu**:

- Thuật toán LZ77 còn cơ bản
- Chưa đạt được tỷ lệ nén tốt nhất

2. **Mã hóa Huffman cố định**:

- Đang dùng bảng mã cố định
- Cần cải tiến sang mã hóa động

3. **Xử lý bộ nhớ**:

- File lớn có thể gây tràn bộ nhớ
- Cần thêm xử lý theo luồng

4. **Vẫn còn lỗi sau khi nén file và tối ưu hoá**:

- Lỗi với data lớn

## Cách chạy

1. Cài đặt Node.js

2. Chạy nén file:

```bash
node name.js
```
