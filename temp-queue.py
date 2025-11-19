with open('components/reception/queue-board-pro.tsx') as f:
    lines=f.readlines()
for i in range(120, 220):
    print(f"{i+1}: {lines[i].rstrip()}")
