import { useEffect, useRef, useState } from "react"
import { useDropzone } from "react-dropzone"
import { FiUploadCloud } from "react-icons/fi"
import { useSelector } from "react-redux"

import "video-react/dist/video-react.css"
import { Player } from "video-react"



export default function Upload({ name, label, register, setValue, errors, video = false, viewData = null, editData = null, uploadProgress = 0 }) {
  // const { course } = useSelector((state) => state.course)
  const [selectedFile, setSelectedFile] = useState(null)
  const [previewSource, setPreviewSource] = useState(viewData ? viewData : editData ? editData : "")

  const onDrop = (acceptedFiles) => {
    const file = acceptedFiles[0]
    if (file) {
      previewFile(file)
      setSelectedFile(file)
    }
  }

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: !video
      ? { "image/*": [".jpeg", ".jpg", ".png"] }
      : { "video/*": [".mp4", ".mkv", ".mov", ".webm", ".wmv"] },
    onDrop,
  })

  const previewFile = (file) => {
    // console.log(file)
    const reader = new FileReader()
    reader.readAsDataURL(file)
    reader.onloadend = () => {
      setPreviewSource(reader.result)
    }
  }

  useEffect(() => {
    if (viewData) {
      setPreviewSource(viewData)
    } else if (editData) {
      setPreviewSource(editData)
    }
  }, [viewData, editData])

  useEffect(() => {
    register(name, { required: true })
  }, [register])


  useEffect(() => {
    setValue(name, selectedFile)
  }, [selectedFile, setValue])

  return (
    <div className="flex flex-col space-y-2">
      <label className="text-sm text-richblack-5" htmlFor={name}>
        {label} {!viewData && <sup className="text-pink-200">*</sup>}
      </label>

      <div
        className={`${isDragActive ? "bg-richblack-600" : "bg-richblack-700"}
         flex min-h-[250px] cursor-pointer items-center justify-center rounded-md border-2 border-dotted border-richblack-500`}
      >
        {previewSource ? (
          <div className="flex w-full flex-col p-6">
            {!video ? (
              <img
                src={previewSource}
                alt="Preview"
                className="h-full w-full rounded-md object-cover"
              />
            ) : (
              <Player aspectRatio="16:9" playsInline src={previewSource} />
            )}

            {!viewData && (
              <div className="mt-3 flex justify-center gap-x-4">
                <button
                  type="button"
                  onClick={() => {
                    setPreviewSource("")
                    setSelectedFile(null)
                    setValue(name, null)
                  }}
                  className="rounded-md bg-richblack-600 py-1 px-4 text-xs font-medium text-richblack-5 hover:bg-richblack-500"
                >
                  Change Video
                </button>
              </div>
            )}
          </div>
        ) : (
          <div
            className="flex w-full flex-col items-center p-6"
            {...getRootProps()}
          >
            <input {...getInputProps()} />
            <div className="grid aspect-square w-14 place-items-center rounded-full bg-pure-greys-800">
              <FiUploadCloud className="text-2xl text-yellow-50" />
            </div>
            <p className="mt-2 max-w-[200px] text-center text-sm text-richblack-200">
              Drag and drop an {!video ? "image" : "video"}, or click to{" "}
              <span className="font-semibold text-yellow-50">Browse</span> a
              file
            </p>
            <button
              type="button"
              className="mt-2 rounded-md bg-yellow-50 px-4 py-2 text-sm font-semibold text-richblack-900 shadow-[2px_2px_0px_0px_rgba(255,255,255,0.18)] transition-all duration-200 hover:scale-95 hover:shadow-none"
            >
              Select File
            </button>
            <ul className="mt-10 flex list-disc justify-between space-x-12 text-center  text-xs text-richblack-200">
              <li>Aspect ratio 16:9</li>
              <li>Recommended size 1024x576</li>
            </ul>
          </div>
        )}
      </div>

      {uploadProgress > 0 && (
        <div className="mt-2 w-full">
          <div className="bg-richblack-700 rounded-full h-2.5 overflow-hidden">
            <div 
              className={`h-full transition-all duration-300 ease-in-out ${uploadProgress === 100 ? "bg-caribbeangreen-300" : "bg-yellow-50"}`} 
              style={{ width: `${uploadProgress}%` }}
            ></div>
          </div>
          <div className="flex justify-between items-center mt-1">
            <p className={`text-xs ${uploadProgress === 100 ? "text-caribbeangreen-300 font-bold" : "text-yellow-50"}`}>
              {uploadProgress === 100 ? "✓ Upload Complete" : `${uploadProgress}% Uploading...`}
            </p>
            {uploadProgress === 100 && (
              <p className="text-[10px] text-richblack-300">Processing on Cloudinary...</p>
            )}
          </div>
        </div>
      )}

      {errors[name] && (
        <span className="ml-2 text-xs tracking-wide text-pink-200">
          {label} is required
        </span>
      )}
    </div>
  )
}