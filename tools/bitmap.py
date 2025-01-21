import imageio.v3 as iio
im = iio.imread("in.png")
f = open("out.txt", "w")
frow = ""
for row in im:
    for c in row:
        if c[3] > 128:
            frow += "O"
        else:
            frow += "."
    f.writelines(frow)
    frow = "\n"