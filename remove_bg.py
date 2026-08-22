from PIL import Image

def remove_white_bg(input_path, output_path):
    img = Image.open(input_path)
    img = img.convert("RGBA")
    datas = img.getdata()

    newData = []
    # threshold for white
    for item in datas:
        # Check if the pixel is close to white
        if item[0] > 240 and item[1] > 240 and item[2] > 240:
            # Change all white (also shades of whites)
            newData.append((255, 255, 255, 0))
        else:
            newData.append(item)

    img.putdata(newData)
    # also crop whitespace
    bbox = img.getbbox()
    if bbox:
        img = img.crop(bbox)
        
    img.save(output_path, "PNG")

remove_white_bg("/Users/alli/.gemini/antigravity/brain/0d2e8be0-c72c-4ae0-8f35-599ec6c963e8/.user_uploaded/media_1787390431075.jpg", "/Users/alli/Desktop/BTHRIFT/src/assets/thriftyfy-logo.png")
