#!/bin/zsh
cd -- "$(dirname "$0")/.." || exit 1
mkdir -p .local-data/dynamodb .local-tools/classes
vita_java=.local-tools/java/amazon-corretto-21.jdk/Contents/Home/bin
"$vita_java/javac" -proc:none -cp '.local-tools/dynamodb/DynamoDBLocal.jar:.local-tools/dynamodb/DynamoDBLocal_lib/*' -d .local-tools/classes scripts/LoopbackDynamo.java || exit 1
exec "$vita_java/java" -Djava.library.path=.local-tools/dynamodb/DynamoDBLocal_lib -cp '.local-tools/classes:.local-tools/dynamodb/DynamoDBLocal.jar:.local-tools/dynamodb/DynamoDBLocal_lib/*' LoopbackDynamo -sharedDb -dbPath .local-data/dynamodb -port 8000 -disableTelemetry
