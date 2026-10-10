import os


from flask import Blueprint, jsonify, send_file
from tensorflow import keras
import json

from utils.model_config import load_labels

model_bp = Blueprint("model",__name__)
CONFIG_PATH="./config.json"

@model_bp.route("/models")
def get_models():
    with open(CONFIG_PATH, "r", encoding="utf-8") as f:
        config = json.load(f)

    public_fields = [
        "version",
        "display_name",
        "task",
        "dataset",
        "input",
        "output",
        "preprocessing"
    ]

    public_models = {}

    for model_name, model_info in config["models"].items():
        public_models[model_name] = {
            key: model_info[key]
            for key in public_fields
            if key in model_info
        }

    return jsonify(public_models), 200

    
@model_bp.route("/models/label/<model_name>")
def load_label(model_name):
    return jsonify(load_labels(model_name=model_name))

