def parseEnv(envFile):
    env = {}
    with open(envFile, "r") as f:
        for line in f:
            splitLine = line.strip().split("=")
            if len(splitLine) == 2:
                env[splitLine[0]] = splitLine[1]
    return env
