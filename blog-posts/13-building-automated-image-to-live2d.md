# Building an Automated Image-to-Live2D Pipeline: A Developer's Guide

**For Developers:** This guide provides a technical blueprint for building an automated image-to-Live2D conversion pipeline. We'll cover the AI models, file formats, and integration strategies needed to turn a single character image into a fully rigged, interactive Live2D model.

## 🏗️ Pipeline Architecture Overview

The complete pipeline consists of 6 stages, each requiring specific AI models or algorithms:

```
📷 Input Image → 🔪 Segmentation → 🎨 Inpainting → 🕸️ Mesh Gen → ⚙️ Rigging → 📦 Export
```

| Stage | Input | Output | AI/Algorithm |
|-------|-------|--------|--------------|
| 1. Segmentation | Single image | Layer masks | Semantic segmentation (UNet, ISNet) |
| 2. Inpainting | Layer masks + image | Complete layers (RGBA) | Diffusion inpainting, amodal completion |
| 3. Mesh Generation | RGBA layers | Triangulated meshes | Delaunay triangulation, edge detection |
| 4. Deformer Setup | Meshes | Warp/rotation deformers | Template matching, pose estimation |
| 5. Parameter Binding | Deformers | Keyform animations | Predefined templates or AI prediction |
| 6. Export | All above | .model3.json + .moc3 | Live2D Cubism SDK |

## Stage 1: Semantic Segmentation

The first step is splitting the character image into semantic parts: face, hair, eyes, eyebrows, mouth, body, clothes, accessories.

### Choose a Segmentation Model

**SkyTNT/anime-segmentation**  
High-accuracy anime character segmentation using ISNet. Trained on combined datasets for robust performance.  
[github.com/SkyTNT/anime-segmentation](https://github.com/SkyTNT/anime-segmentation)

**siyeong0/Anime-Face-Segmentation**  
UNet-based model specifically for anime faces. Classes: background, hair, eye, mouth, face, skin, clothes.  
[github.com/siyeong0/Anime-Face-Segmentation](https://github.com/siyeong0/Anime-Face-Segmentation)

**Hugging Face: skytnt/anime-segmentation**  
Pre-trained models and datasets ready for inference or fine-tuning.  
[huggingface.co/skytnt/anime-segmentation](https://huggingface.co/skytnt/anime-segmentation)

```python
# Example: Anime segmentation with ISNet
from anime_segmentation import get_model

model = get_model("isnet_anime")
masks = model.predict(image)  # Returns dict of layer masks

# Expected output layers:
# - "face": mask for face area
# - "hair": mask for hair (may be multiple: front_hair, back_hair)
# - "left_eye", "right_eye": individual eye masks
# - "mouth": mouth/lips area
# - "body": torso and limbs
# - "clothes": outfit layers
```

> **💡 Key Challenge:** Standard models often output body-part masks but NOT the depth ordering. You need to determine which layers go in front (e.g., front hair over face, face over back hair). This can be heuristic-based or learned from training data.

## Stage 2: Amodal Inpainting

Each layer mask defines a visible region, but Live2D layers need the COMPLETE part—including areas hidden behind other layers. This is called "amodal completion."

### Fill in Occluded Regions

**Stable Diffusion Inpainting**  
Use SD inpainting to fill masked regions. Works well for extending hair behind the face, completing eyes behind bangs, etc.  
[huggingface.co/runwayml/stable-diffusion-inpainting](https://huggingface.co/runwayml/stable-diffusion-inpainting)

**pix2gestalt (Amodal Completion)**  
Latent diffusion model trained specifically for amodal completion—synthesizing full objects from partially visible ones.  
[github.com/cvlab-columbia/pix2gestalt](https://github.com/cvlab-columbia/pix2gestalt)

**LaMa (Large Mask Inpainting)**  
Fast Fourier convolution-based inpainting. Great for large masked regions.  
[github.com/advimman/lama](https://github.com/advimman/lama)

```python
# Example: Inpainting workflow
from diffusers import StableDiffusionInpaintPipeline

pipe = StableDiffusionInpaintPipeline.from_pretrained(
    "runwayml/stable-diffusion-inpainting"
)

for layer_name, mask in masks.items():
    # Expand mask to include occluded regions that need filling
    occlusion_mask = compute_occlusion_mask(layer_name, all_masks)
    
    # Inpaint the hidden parts
    completed_layer = pipe(
        prompt=f"anime character {layer_name}, consistent style",
        image=original_image,
        mask_image=occlusion_mask
    ).images[0]
    
    # Extract layer with alpha channel
    rgba_layer = apply_alpha_mask(completed_layer, mask)
    layers[layer_name] = rgba_layer
```

> **🎯 Pro Tip:** For anime hair, you typically need to inpaint 30-50% more area behind the face. Use the face silhouette expanded by a margin as the inpainting mask for the hair layer.

## Stage 3: Mesh Generation

Each RGBA layer needs a deformable mesh. The mesh defines how the layer can be warped and animated.

Live2D uses triangulated meshes where vertices can be moved to deform the texture.

```python
# Example: Mesh generation for a layer
import cv2
from scipy.spatial import Delaunay

def generate_mesh(rgba_layer, density="medium"):
    # Extract alpha channel for shape
    alpha = rgba_layer[:, :, 3]
    
    # Find contours (outline of the layer)
    contours, _ = cv2.findContours(alpha, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    
    # Sample points along contours
    edge_points = sample_contour_points(contours, spacing=10)
    
    # Add interior points for better deformation
    interior_points = generate_interior_grid(alpha, spacing=20)
    
    # Combine and triangulate
    all_points = np.vstack([edge_points, interior_points])
    triangles = Delaunay(all_points)
    
    return {
        "vertices": all_points,  # [[x, y], ...]
        "triangles": triangles.simplices,  # [[v0, v1, v2], ...]
        "uvs": normalize_to_uv(all_points, rgba_layer.shape)  # Texture coords
    }
```

> **⚠️ Mesh Density Matters:**
> - **Too sparse:** Deformations look blocky and unnatural
> - **Too dense:** Performance issues, harder to animate
> - **Sweet spot:** ~50-200 vertices per major part (eye, mouth), ~200-500 for large parts (hair, body)

## Stage 4: Deformer Setup

Deformers control HOW the mesh moves. Live2D has two types:

| Deformer Type | Best For | How It Works |
|---------------|----------|--------------|
| **Warp Deformer** | Organic shapes (hair, clothes) | Grid of control points that bend the mesh |
| **Rotation Deformer** | Rigid parts (head, limbs) | Rotates around a pivot point |

```python
# Example: Deformer structure template
DEFORMER_TEMPLATE = {
    "root": {
        "type": "rotation",
        "children": {
            "head": {
                "type": "rotation",
                "params": ["ParamAngleX", "ParamAngleY", "ParamAngleZ"],
                "children": {
                    "face": { "type": "warp", "grid": [3, 3] },
                    "front_hair": { "type": "warp", "grid": [4, 4], "physics": True },
                    "back_hair": { "type": "warp", "grid": [4, 4], "physics": True },
                    "left_eye": {
                        "type": "warp",
                        "params": ["ParamEyeLOpen", "ParamEyeBallX", "ParamEyeBallY"]
                    },
                    "right_eye": { /* mirror of left_eye */ },
                    "mouth": {
                        "type": "warp",
                        "params": ["ParamMouthOpenY", "ParamMouthForm"]
                    }
                }
            },
            "body": {
                "type": "rotation",
                "params": ["ParamBodyAngleX", "ParamBodyAngleY"]
            }
        }
    }
}
```

## Stage 5: Parameter & Keyform Binding

Parameters define controllable variables (e.g., "ParamMouthOpenY" = 0 to 1). Keyforms define what the mesh looks like at specific parameter values.

### Option A: Template-Based (Recommended for MVP)

```python
# Use predefined deformation patterns
KEYFORM_TEMPLATES = {
    "ParamMouthOpenY": {
        0.0: "mouth_closed.json",   # Mouth vertices at rest
        1.0: "mouth_open.json"      # Mouth vertices stretched down
    },
    "ParamEyeLOpen": {
        0.0: "eye_closed.json",    # Eyelid vertices covering eye
        1.0: "eye_open.json"       # Eyelid vertices raised
    }
}

# Apply template deformations scaled to the actual mesh
def apply_template(mesh, param_name, param_value, templates):
    template = templates[param_name][param_value]
    scaled_offsets = scale_template_to_mesh(template, mesh)
    return mesh.vertices + scaled_offsets
```

### Option B: AI-Predicted Deformations (Advanced)

```python
# Train a model to predict vertex offsets
# Input: mesh vertices, parameter name, parameter value
# Output: vertex offset deltas

class DeformationPredictor(nn.Module):
    def forward(self, vertices, param_embedding, param_value):
        # Encoder-decoder architecture
        # Predicts how each vertex should move
        return vertex_offsets
```

> **🔑 Critical Parameters for Chatbot Use:**
> - `ParamMouthOpenY` - Lip sync (REQUIRED)
> - `ParamMouthForm` - Smile/frown
> - `ParamEyeLOpen` / `ParamEyeROpen` - Blinking
> - `ParamAngleX/Y/Z` - Head tilt
>
> At minimum, implement `ParamMouthOpenY` for basic lip sync functionality.

## Stage 6: Export to Live2D Format

Live2D models consist of multiple files:

```
📁 output_model/
├── model.model3.json  ← Entry point, links everything
├── model.moc3         ← Compiled binary (mesh, deformers, params)
├── 📁 textures/
│   └── texture_00.png ← Packed texture atlas
├── model.physics3.json ← Physics simulation config
└── 📁 motions/
    └── idle.motion3.json ← Optional animations
```

```json
// model3.json structure
{
    "Version": 3,
    "FileReferences": {
        "Moc": "model.moc3",
        "Textures": ["textures/texture_00.png"],
        "Physics": "model.physics3.json",
        "Motions": {
            "Idle": [{ "File": "motions/idle.motion3.json" }]
        }
    },
    "Groups": [
        { "Target": "Parameter", "Name": "LipSync", "Ids": ["ParamMouthOpenY"] },
        { "Target": "Parameter", "Name": "EyeBlink", "Ids": ["ParamEyeLOpen", "ParamEyeROpen"] }
    ]
}
```

> **⚠️ The .moc3 Challenge:** The `.moc3` file is a proprietary binary format. You have two options:
> 1. **Use Live2D Cubism SDK:** Export from Cubism Editor (requires their software)
> 2. **Reverse-engineer format:** Community efforts exist but are incomplete and legally gray
> 3. **Alternative:** Export to an intermediate format and convert using Cubism Editor's batch export

## 🛠️ Implementation Approaches

### Approach A: Python Pipeline + Cubism Export

1. Run segmentation + inpainting in Python
2. Export layered PSD with layer names matching Cubism conventions
3. Use Cubism Editor's auto-mesh and template features
4. Script Cubism Editor automation if possible

### Approach B: WebGL Runtime (No .moc3)

1. Build your own simplified Live2D-like renderer
2. Use JSON for mesh/deformer/parameter definitions
3. Render with WebGL/Three.js
4. Less compatible but fully open

### Approach C: Hybrid with ComfyUI

1. Use ComfyUI workflows for segmentation + inpainting
2. Export intermediate format
3. Post-process into Live2D structure

## 📚 Resources & Libraries

| Component | Library/Tool | Link |
|-----------|--------------|------|
| Anime Segmentation | anime-segmentation | [GitHub](https://github.com/SkyTNT/anime-segmentation) |
| Face Segmentation | Anime-Face-Segmentation | [GitHub](https://github.com/siyeong0/Anime-Face-Segmentation) |
| Inpainting | Stable Diffusion Inpainting | [HuggingFace](https://huggingface.co/runwayml/stable-diffusion-inpainting) |
| Amodal Completion | pix2gestalt | [GitHub](https://github.com/cvlab-columbia/pix2gestalt) |
| Layer Decomposition | Qwen-Image-Layered | [HuggingFace](https://huggingface.co/Qwen) |
| Live2D SDK | Cubism SDK for Web | [live2d.com](https://www.live2d.com/en/download/cubism-sdk/) |
| Mesh Generation | scipy.spatial.Delaunay | [SciPy](https://docs.scipy.org/doc/scipy/reference/generated/scipy.spatial.Delaunay.html) |

## 🎯 Minimum Viable Pipeline

**Start Here:** For a working prototype, focus on:

1. Segment face + hair + eyes + mouth (4 layers minimum)
2. Inpaint hair behind face
3. Generate simple quad meshes (not full triangulation)
4. Implement only `ParamMouthOpenY` keyforms
5. Export as custom JSON + use a WebGL renderer

This gives you a talking avatar from a single image. Expand from there.

The full automated pipeline is challenging but achievable. Start with the MVP, iterate on quality, and expand parameter support over time. 🚀
