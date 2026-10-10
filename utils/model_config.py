import os

from flask import jsonify
import tensorflow as tf
from tensorflow import keras
import json
import pandas as pd

CONFIG_PATH="./config.json"


def load_model(model_name):
    with open (CONFIG_PATH,"r",encoding="utf-8") as f:
        paths=json.load(f)
        model=paths['models'][model_name]
        full_path= os.path.join(paths["MODEL_PATH"],str(model['name']))
        model = keras.models.load_model(full_path)
        print(f"Model {model_name} loaded successfully.")
        print("Input shape :", model.input_shape)
        print("Output shape:", model.output_shape)
        return model

def load_labels(model_name):
    with open(CONFIG_PATH,"r",encoding="utf-8") as f:
        paths = json.load(f)
        class_name= os.path.join(paths['properties'],str(paths['models'][model_name]['labels']))
        df = pd.read_csv(class_name)
        mapping = dict(zip(
        df["index"],
        zip(
        df["romaji"],
        df["codepoint"].apply(
            lambda cp: chr(int(cp.replace("U+", ""), 16))
        ))))    
        return mapping
