with open('components/patient/patient-details.tsx') as f:
    for i,line in enumerate(f,1):
        if 180 <= i <= 230:
            print(f"{i}: {line.rstrip()}")
